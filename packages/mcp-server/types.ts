import type { GraphStore } from '@codeagent/graph-store';

// MCP Tool definition
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}

// Tool handler function
export type ToolHandler = (args: Record<string, any>) => Promise<any>;

// Resource definition
export interface ResourceDefinition {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

// Resource handler
export type ResourceHandler = (uri: string) => Promise<string>;

// Server configuration
export interface ServerConfig {
    name?: string;
    version?: string;
    graphStore?: GraphStore;
    repoPath?: string;
}

// Tool context passed to handlers
export interface ToolContext {
    graph: GraphStore;
    repoPath: string;
}