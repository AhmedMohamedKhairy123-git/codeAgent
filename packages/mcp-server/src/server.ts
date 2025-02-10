import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createGraphStore } from '@codeagent/graph-store';
import { ToolRegistry, registerAllTools } from './tools/index.js';
import { ResourceRegistry, registerAllResources } from './resources/index.js';
import type { ServerConfig, ToolContext } from './types.js';

export class MCPServer {
    private server: Server;
    private tools: ToolRegistry;
    private resources: ResourceRegistry;
    private context: ToolContext;

    constructor(config: ServerConfig = {}) {
        this.server = new Server(
            {
                name: config.name || 'codeagent',
                version: config.version || '0.1.0',
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {},
                },
            }
        );

        this.context = {
            graph: config.graphStore || createGraphStore(),
            repoPath: config.repoPath || process.cwd(),
        };

        this.tools = new ToolRegistry(this.context);
        this.resources = new ResourceRegistry(this.context);

        this.setupHandlers();
    }

    private setupHandlers(): void {
        // List tools handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: this.tools.list(),
        }));

        // Call tool handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                const result = await this.tools.call(name, args || {});
                return {
                    content: [
                        {
                            type: 'text',
                            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{ type: 'text', text: `Error: ${message}` }],
                    isError: true,
                };
            }
        });

        // List resources handler
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: this.resources.list(),
        }));

        // Read resource handler
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;

            try {
                const content = await this.resources.read(uri);
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/plain',
                            text: content,
                        },
                    ],
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Resource not found';
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/plain',
                            text: `Error: ${message}`,
                        },
                    ],
                };
            }
        });

        // List prompts handler
        this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
            prompts: [
                {
                    name: 'analyze_code',
                    description: 'Analyze code structure and relationships',
                    arguments: [
                        { name: 'file', description: 'File to analyze', required: true },
                    ],
                },
                {
                    name: 'find_callers',
                    description: 'Find all functions that call a given function',
                    arguments: [
                        { name: 'function', description: 'Function name', required: true },
                    ],
                },
            ],
        }));

        // Get prompt handler
        this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            if (name === 'analyze_code') {
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `Analyze the code in ${args?.file}. Identify the main functions, classes, and their relationships.`,
                            },
                        },
                    ],
                };
            }

            if (name === 'find_callers') {
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `Find all functions that call ${args?.function}. List them with file paths and line numbers.`,
                            },
                        },
                    ],
                };
            }

            throw new Error(`Unknown prompt: ${name}`);
        });
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('CodeAgent MCP server running on stdio');
    }

    async stop(): Promise<void> {
        await this.server.close();
    }
}

// Convenience function to start server
export async function startServer(config?: ServerConfig): Promise<void> {
    const server = new MCPServer(config);
    await server.start();
}