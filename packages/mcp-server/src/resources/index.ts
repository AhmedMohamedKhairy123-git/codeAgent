import type { ResourceDefinition, ResourceHandler, ToolContext } from '../types.js';

export class ResourceRegistry {
    private resources: Map<string, ResourceHandler> = new Map();
    private definitions: ResourceDefinition[] = [];

    constructor(private context: ToolContext) { }

    register(definition: ResourceDefinition, handler: ResourceHandler): void {
        this.definitions.push(definition);
        this.resources.set(definition.uri, handler);
    }

    list(): ResourceDefinition[] {
        return this.definitions;
    }

    async read(uri: string): Promise<string> {
        const handler = this.resources.get(uri);
        if (!handler) {
            // Try to match template URI
            for (const [pattern, h] of this.resources) {
                if (uri.startsWith(pattern.replace('{name}', ''))) {
                    return h(uri);
                }
            }
            throw new Error(`Resource not found: ${uri}`);
        }
        return handler(uri);
    }
}

// Register all resources
export function registerAllResources(registry: ResourceRegistry): void {
    registry.register(
        {
            uri: 'codeagent://repos',
            name: 'All Indexed Repositories',
            description: 'List of all indexed repos with stats',
            mimeType: 'text/yaml',
        },
        () => listReposResource(registry.context)
    );

    registry.register(
        {
            uri: 'codeagent://repo/context',
            name: 'Repo Context',
            description: 'Codebase overview and stats',
            mimeType: 'text/yaml',
        },
        () => repoContextResource(registry.context)
    );
}

async function listReposResource(context: ToolContext): Promise<string> {
    const lines = [
        'repos:',
        `  - name: ${path.basename(context.repoPath)}`,
        `    path: ${context.repoPath}`,
        `    nodes: ${context.graph.nodeCount}`,
        `    edges: ${context.graph.edgeCount}`,
        '',
        '# Tools available:',
        '#   - query: Search execution flows',
        '#   - context: Symbol 360° view',
        '#   - impact: Blast radius analysis',
    ];
    return lines.join('\n');
}

async function repoContextResource(context: ToolContext): Promise<string> {
    const projectName = path.basename(context.repoPath);

    // Count nodes by kind
    const nodeKinds = new Map<string, number>();
    for (const [_, node] of context.graph.nodes) {
        nodeKinds.set(node.kind, (nodeKinds.get(node.kind) || 0) + 1);
    }

    const lines = [
        `project: ${projectName}`,
        '',
        'stats:',
        `  files: ${nodeKinds.get('File') || 0}`,
        `  functions: ${nodeKinds.get('Function') || 0}`,
        `  classes: ${nodeKinds.get('Class') || 0}`,
        `  methods: ${nodeKinds.get('Method') || 0}`,
        `  interfaces: ${nodeKinds.get('Interface') || 0}`,
        `  total_nodes: ${context.graph.nodeCount}`,
        `  total_edges: ${context.graph.edgeCount}`,
        '',
        'tools_available:',
        '  - query: Search execution flows related to a concept',
        '  - context: 360-degree symbol view (callers, callees)',
        '  - impact: Blast radius analysis',
        '  - cypher: Raw graph queries',
        '  - list_repos: Discover all indexed repositories',
        '',
        'resources_available:',
        '  - codeagent://repos: All indexed repositories',
        '  - codeagent://repo/context: This overview',
    ];

    return lines.join('\n');
}

import path from 'path';