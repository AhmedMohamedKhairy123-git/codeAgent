import type { ToolDefinition, ToolHandler, ToolContext } from '../types.js';

export class ToolRegistry {
    private tools: Map<string, ToolHandler> = new Map();
    private definitions: ToolDefinition[] = [];

    constructor(private context: ToolContext) { }

    register(definition: ToolDefinition, handler: ToolHandler): void {
        this.definitions.push(definition);
        this.tools.set(definition.name, handler);
    }

    list(): ToolDefinition[] {
        return this.definitions;
    }

    async call(name: string, args: Record<string, any>): Promise<any> {
        const handler = this.tools.get(name);
        if (!handler) {
            throw new Error(`Unknown tool: ${name}`);
        }
        return handler(args);
    }
}

export function registerAllTools(registry: ToolRegistry): void {
    registry.register(
        {
            name: 'query',
            description: 'Search for symbols, functions, classes, or execution flows in the codebase',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search term (name, file pattern, or concept)' },
                    kind: { type: 'string', description: 'Filter by node kind (Function, Class, Method, etc.)' },
                    file: { type: 'string', description: 'Filter by file path pattern' },
                    limit: { type: 'number', description: 'Maximum results to return', default: 20 },
                },
                required: ['query'],
            },
        },
        async (args) => {
            const { query, kind, file, limit = 20 } = args;
            const results = [];

            for (const [id, node] of registry.context.graph.nodes) {
                if (results.length >= limit) break;

                const matchesQuery = node.name.toLowerCase().includes(query.toLowerCase()) ||
                    node.filePath.toLowerCase().includes(query.toLowerCase());
                const matchesKind = !kind || node.kind === kind;
                const matchesFile = !file || node.filePath.includes(file);

                if (matchesQuery && matchesKind && matchesFile) {
                    results.push({
                        id: node.id,
                        name: node.name,
                        kind: node.kind,
                        file: node.filePath,
                        line: node.startLine,
                        exported: node.isExported,
                    });
                }
            }

            return {
                query,
                count: results.length,
                results,
            };
        }
    );

    registry.register(
        {
            name: 'context',
            description: 'Get 360-degree context for a symbol (callers, callees, inheritance)',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Symbol name to analyze' },
                    id: { type: 'string', description: 'Symbol ID (alternative to name)' },
                    depth: { type: 'number', description: 'Relationship depth', default: 2 },
                },
                required: [],
            },
        },
        async (args) => {
            const { name, id, depth = 2 } = args;
            let targetId = id;

            if (!targetId && name) {
                for (const [nodeId, node] of registry.context.graph.nodes) {
                    if (node.name === name) {
                        targetId = nodeId;
                        break;
                    }
                }
            }

            if (!targetId) {
                throw new Error(`Symbol not found: ${name || id}`);
            }

            const symbol = registry.context.graph.getNode(targetId);
            if (!symbol) {
                throw new Error(`Symbol not found: ${targetId}`);
            }

            const callers: any[] = [];
            const callees: any[] = [];
            const visited = new Set<string>();

            const traverse = (currentId: string, direction: 'in' | 'out', currentDepth: number) => {
                if (currentDepth > depth) return;
                if (visited.has(`${currentId}:${direction}`)) return;
                visited.add(`${currentId}:${direction}`);

                const edges = direction === 'out'
                    ? registry.context.graph.getOutgoing(currentId)
                    : registry.context.graph.getIncoming(currentId);

                for (const edge of edges) {
                    const neighborId = direction === 'out' ? edge.targetId : edge.sourceId;
                    const neighbor = registry.context.graph.getNode(neighborId);
                    if (neighbor && neighbor.kind !== 'File') {
                        const item = {
                            id: neighbor.id,
                            name: neighbor.name,
                            kind: neighbor.kind,
                            file: neighbor.filePath,
                            line: neighbor.startLine,
                            confidence: edge.confidence,
                        };
                        if (direction === 'out') {
                            callees.push(item);
                        } else {
                            callers.push(item);
                        }
                        traverse(neighborId, direction, currentDepth + 1);
                    }
                }
            };

            traverse(targetId, 'in', 1);
            traverse(targetId, 'out', 1);

            const parents = registry.context.graph.getIncoming(targetId)
                .filter(e => e.kind === 'EXTENDS' || e.kind === 'IMPLEMENTS')
                .map(e => registry.context.graph.getNode(e.sourceId))
                .filter(n => n);

            const children = registry.context.graph.getOutgoing(targetId)
                .filter(e => e.kind === 'EXTENDS' || e.kind === 'IMPLEMENTS')
                .map(e => registry.context.graph.getNode(e.targetId))
                .filter(n => n);

            return {
                symbol: {
                    id: symbol.id,
                    name: symbol.name,
                    kind: symbol.kind,
                    file: symbol.filePath,
                    line: symbol.startLine,
                    exported: symbol.isExported,
                    language: symbol.language,
                },
                callers: callers.slice(0, 50),
                callees: callees.slice(0, 50),
                inheritance: {
                    parents: parents.map(p => ({ id: p.id, name: p.name, kind: p.kind, file: p.filePath })),
                    children: children.map(c => ({ id: c.id, name: c.name, kind: c.kind, file: c.filePath })),
                },
                stats: {
                    callerCount: callers.length,
                    calleeCount: callees.length,
                    parentCount: parents.length,
                    childCount: children.length,
                },
            };
        }
    );

    registry.register(
        {
            name: 'impact',
            description: 'Analyze blast radius of changes to a symbol (find all affected downstream/upstream)',
            inputSchema: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: 'Symbol name or ID to analyze' },
                    direction: { type: 'string', enum: ['upstream', 'downstream', 'both'], default: 'downstream' },
                    maxDepth: { type: 'number', description: 'Maximum traversal depth', default: 5 },
                },
                required: ['target'],
            },
        },
        async (args) => {
            const { target, direction = 'downstream', maxDepth = 5 } = args;
            let targetId = target;

            if (!targetId.includes(':')) {
                for (const [nodeId, node] of registry.context.graph.nodes) {
                    if (node.name === target) {
                        targetId = nodeId;
                        break;
                    }
                }
            }

            const symbol = registry.context.graph.getNode(targetId);
            if (!symbol) {
                throw new Error(`Symbol not found: ${target}`);
            }

            const impacted = new Map<string, { node: any; depth: number; path: string[] }>();
            const queue: Array<{ id: string; depth: number; path: string[] }> = [{ id: targetId, depth: 0, path: [targetId] }];
            const visited = new Set<string>();

            while (queue.length > 0) {
                const { id, depth, path } = queue.shift()!;
                if (depth >= maxDepth) continue;
                if (visited.has(id)) continue;
                visited.add(id);

                const edges = direction === 'downstream' || direction === 'both'
                    ? registry.context.graph.getOutgoing(id)
                    : [];

                const incomingEdges = direction === 'upstream' || direction === 'both'
                    ? registry.context.graph.getIncoming(id)
