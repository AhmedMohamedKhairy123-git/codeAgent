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
                    : [];

                const allEdges = [...edges, ...incomingEdges];

                for (const edge of allEdges) {
                    const neighborId = direction === 'downstream' ? edge.targetId : edge.sourceId;
                    if (neighborId === targetId) continue;

                    const neighbor = registry.context.graph.getNode(neighborId);
                    if (neighbor && neighbor.kind !== 'File') {
                        if (!impacted.has(neighborId)) {
                            impacted.set(neighborId, {
                                node: {
                                    id: neighbor.id,
                                    name: neighbor.name,
                                    kind: neighbor.kind,
                                    file: neighbor.filePath,
                                    line: neighbor.startLine,
                                },
                                depth: depth + 1,
                                path: [...path, neighborId],
                            });
                        }

                        if (depth + 1 < maxDepth) {
                            queue.push({ id: neighborId, depth: depth + 1, path: [...path, neighborId] });
                        }
                    }
                }
            }

            const byDepth: Record<number, any[]> = {};
            for (const [_, item] of impacted) {
                if (!byDepth[item.depth]) byDepth[item.depth] = [];
                byDepth[item.depth].push(item.node);
            }

            return {
                target: {
                    id: symbol.id,
                    name: symbol.name,
                    kind: symbol.kind,
                    file: symbol.filePath,
                },
                direction,
                impactedCount: impacted.size,
                byDepth,
                impactedList: Array.from(impacted.values()).map(v => v.node),
            };
        }
    );

    registry.register(
        {
            name: 'find_path',
            description: 'Find shortest path between two symbols in the call graph',
            inputSchema: {
                type: 'object',
                properties: {
                    from: { type: 'string', description: 'Source symbol name or ID' },
                    to: { type: 'string', description: 'Target symbol name or ID' },
                },
                required: ['from', 'to'],
            },
        },
        async (args) => {
            const { from, to } = args;

            const findSymbolId = (nameOrId: string): string | null => {
                if (nameOrId.includes(':')) return nameOrId;
                for (const [id, node] of registry.context.graph.nodes) {
                    if (node.name === nameOrId) return id;
                }
                return null;
            };

            const fromId = findSymbolId(from);
            const toId = findSymbolId(to);

            if (!fromId) throw new Error(`Source symbol not found: ${from}`);
            if (!toId) throw new Error(`Target symbol not found: ${to}`);

            const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
            const visited = new Set<string>([fromId]);

            while (queue.length > 0) {
                const { id, path } = queue.shift()!;

                if (id === toId) {
                    const nodes = path.map(pid => registry.context.graph.getNode(pid)).filter(n => n);
                    return {
                        found: true,
                        length: path.length - 1,
                        path: nodes.map(n => ({
                            id: n!.id,
                            name: n!.name,
                            kind: n!.kind,
                            file: n!.filePath,
                        })),
                    };
                }

                const edges = registry.context.graph.getOutgoing(id);
                for (const edge of edges) {
                    if (!visited.has(edge.targetId)) {
                        visited.add(edge.targetId);
                        queue.push({ id: edge.targetId, path: [...path, edge.targetId] });
                    }
                }
            }

            return { found: false, length: -1, path: [] };
        }
    );

    registry.register(
        {
            name: 'community',
            description: 'Get community information for a symbol or list all communities',
            inputSchema: {
                type: 'object',
                properties: {
                    symbol: { type: 'string', description: 'Symbol name to find community for' },
                    communityId: { type: 'string', description: 'Community ID to get details for' },
                    listAll: { type: 'boolean', description: 'List all communities', default: false },
                },
                required: [],
            },
        },
        async (args) => {
            const { symbol, communityId, listAll = false } = args;

            const communities = new Map<string, { id: string; label: string; members: any[]; cohesion: number }>();

            for (const [id, node] of registry.context.graph.nodes) {
                if (node.kind === 'Community') {
                    communities.set(id, {
                        id: node.id,
                        label: node.name,
                        members: [],
                        cohesion: 0,
                    });
                }
            }

            for (const [_, edge] of registry.context.graph.edges) {
                if (edge.kind === 'MEMBER_OF') {
                    const community = communities.get(edge.targetId);
                    const member = registry.context.graph.getNode(edge.sourceId);
                    if (community && member) {
                        community.members.push({
                            id: member.id,
                            name: member.name,
                            kind: member.kind,
                            file: member.filePath,
                        });
                    }
                }
            }

            if (listAll) {
                return {
                    communities: Array.from(communities.values()).map(c => ({
                        id: c.id,
                        label: c.label,
                        memberCount: c.members.length,
                    })),
                };
            }

            if (communityId) {
                const community = communities.get(communityId);
                if (!community) throw new Error(`Community not found: ${communityId}`);
                return community;
            }

            if (symbol) {
                let symbolId = symbol;
                if (!symbolId.includes(':')) {
                    for (const [id, node] of registry.context.graph.nodes) {
                        if (node.name === symbol) {
                            symbolId = id;
                            break;
                        }
                    }
                }

                for (const [_, edge] of registry.context.graph.edges) {
                    if (edge.kind === 'MEMBER_OF' && edge.sourceId === symbolId) {
                        const community = communities.get(edge.targetId);
                        if (community) {
                            return {
                                symbol,
                                community: {
                                    id: community.id,
                                    label: community.label,
                                    memberCount: community.members.length,
                                },
                            };
                        }
                    }
                }

                return { symbol, community: null };
            }

            return { communities: Array.from(communities.values()).slice(0, 50) };
        }
    );

    registry.register(
        {
            name: 'list_repos',
            description: 'List all indexed repositories with their statistics',
            inputSchema: {
                type: 'object',
                properties: {
                    detail: { type: 'boolean', description: 'Show detailed statistics', default: false },
                },
                required: [],
            },
        },
        async (args) => {
            const { detail = false } = args;

            const nodeKinds = new Map<string, number>();
            const relationKinds = new Map<string, number>();

            for (const [_, node] of registry.context.graph.nodes) {
                nodeKinds.set(node.kind, (nodeKinds.get(node.kind) || 0) + 1);
            }

            for (const [_, edge] of registry.context.graph.edges) {
                relationKinds.set(edge.kind, (relationKinds.get(edge.kind) || 0) + 1);
            }

            const result: any = {
                current: {
                    path: registry.context.repoPath,
                    name: registry.context.repoPath.split('/').pop(),
                    nodeCount: registry.context.graph.nodeCount,
                    edgeCount: registry.context.graph.edgeCount,
                },
            };

            if (detail) {
                result.current.nodeBreakdown = Object.fromEntries(nodeKinds);
                result.current.edgeBreakdown = Object.fromEntries(relationKinds);
            }

            return result;
        }
    );
}