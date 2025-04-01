#!/usr/bin/env node
import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { statusCommand } from './commands/status.js';
import { listCommand } from './commands/list.js';
import { cleanCommand } from './commands/clean.js';
import { serveCommand } from './commands/serve.js';
import { mcpCommand } from './commands/mcp.js';

const packageJson = {
    name: '@codeagent/cli',
    version: '0.0.1',
    description: 'CodeAgent CLI - Code intelligence toolkit',
};

export function createProgram(): Command {
    const program = new Command();

    program
        .name('codeagent')
        .description(packageJson.description)
        .version(packageJson.version);

    // Analyze command - index a repository
    program
        .command('analyze [path]')
        .description('Index a repository (full analysis)')
        .option('-f, --force', 'Force full re-index even if up to date')
        .option('--embeddings', 'Enable embedding generation for semantic search')
        .option('--skip-embeddings', 'Skip embedding generation (faster)')
        .option('--skills', 'Generate repo-specific skill files')
        .option('-v, --verbose', 'Enable verbose output')
        .action(analyzeCommand);

    // Status command - show index status
    program
        .command('status')
        .description('Show index status for current repo')
        .action(statusCommand);

    // List command - show all indexed repos
    program
        .command('list')
        .description('List all indexed repositories')
        .action(listCommand);

    // Clean command - delete index
    program
        .command('clean')
        .description('Delete GitNexus index for current repo')
        .option('-f, --force', 'Skip confirmation prompt')
        .option('--all', 'Clean all indexed repos')
        .action(cleanCommand);

    // Serve command - start HTTP server
    program
        .command('serve')
        .description('Start local HTTP server for web UI connection')
        .option('-p, --port <port>', 'Port number', '4747')
        .option('--host <host>', 'Bind address', '127.0.0.1')
        .action(serveCommand);

    // MCP command - start MCP server
    program
        .command('mcp')
        .description('Start MCP server (stdio)')
        .option('-r, --repo <path>', 'Repository path', process.cwd())
        .action(mcpCommand);

    return program;
}

export async function main(): Promise<void> {
    const program = createProgram();
    await program.parseAsync(process.argv);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}