import chalk from 'chalk';

export interface ServeOptions {
    port?: string;
    host?: string;
}

export async function serveCommand(options?: ServeOptions): Promise<void> {
    const port = parseInt(options?.port || '4747', 10);
    const host = options?.host || '127.0.0.1';

    console.log(chalk.bold('\n  CodeAgent Server\n'));
    console.log(`  Starting HTTP server on http://${host}:${port}\n`);

    // Dynamic import to avoid loading HTTP server when not needed
    const { startServer } = await import('@codeagent/mcp-server');

    console.log(chalk.gray('  Press Ctrl+C to stop\n'));

    // Simple HTTP server wrapper
    const http = await import('http');
    const server = http.createServer(async (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            name: 'codeagent',
            version: '0.1.0',
            status: 'running',
            endpoints: ['/health', '/api/graph', '/api/query'],
        }));
    });

    server.listen(port, host, () => {
        console.log(chalk.green(`  Server running at http://${host}:${port}`));
    });

    // Handle shutdown
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n  Shutting down...'));
        server.close();
        process.exit(0);
    });
}