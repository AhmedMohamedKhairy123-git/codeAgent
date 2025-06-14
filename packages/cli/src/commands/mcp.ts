import chalk from 'chalk';
import path from 'path';
import { createGraphStore } from '@codeagent/graph-store';
import { startServer } from '@codeagent/mcp-server';

export interface MCPOptions {
    repo?: string;
}

export async function mcpCommand(options?: MCPOptions): Promise<void> {
    const repoPath = options?.repo ? path.resolve(options.repo) : process.cwd();

    console.error(chalk.bold('\n  CodeAgent MCP Server\n'));
    console.error(`  Repository: ${repoPath}\n`);

    // Create graph store (empty for now - will load from index)
    const graph = createGraphStore();

    console.error(chalk.gray('  Starting MCP server on stdio...\n'));

    await startServer({
        graphStore: graph,
        repoPath,
    });
}