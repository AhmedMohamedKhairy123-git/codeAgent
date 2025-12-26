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
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { createGraphStore, GraphStore } from '@codeagent/graph-store';
import { startServer } from '@codeagent/mcp-server';

export interface MCPOptions {
    repo?: string;
}

const STORAGE_DIR = '.codeinsight';

async function loadGraph(repoPath: string): Promise<GraphStore> {
    const graphPath = path.join(repoPath, STORAGE_DIR, 'graph.json');
    try {
        const content = await fs.readFile(graphPath, 'utf-8');
        const data = JSON.parse(content);
        return GraphStore.fromSerializable(data);
    } catch {
        return createGraphStore();
    }
}

export async function mcpCommand(options: MCPOptions = {}): Promise<void> {
    const repoPath = options.repo ? path.resolve(options.repo) : process.cwd();
    const storagePath = path.join(repoPath, STORAGE_DIR);
    const metaPath = path.join(storagePath, 'meta.json');

    console.error(chalk.bold('\n  CodeInsight MCP Server\n'));
    console.error(`  Repository: ${repoPath}\n`);

    try {
        await fs.access(metaPath);
    } catch {
        console.error(chalk.yellow('  No index found. Run: codeinsight analyze\n'));
        process.exit(1);
    }

    console.error(chalk.gray('  Loading graph...'));
    const graph = await loadGraph(repoPath);
    console.error(chalk.green(`  Loaded ${graph.nodeCount} nodes, ${graph.edgeCount} edges\n`));

    console.error(chalk.gray('  Starting MCP server on stdio...\n'));

    await startServer({
        graphStore: graph,
        repoPath,
    });
}