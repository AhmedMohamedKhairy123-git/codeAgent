#!/usr/bin/env node
import { startServer } from './server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const repoPath = args[0] || process.cwd();

console.error(`Starting CodeAgent MCP server for: ${repoPath}`);

startServer({ repoPath }).catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
});