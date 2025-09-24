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
