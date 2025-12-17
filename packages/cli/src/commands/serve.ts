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
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

export interface ServeOptions {
    port?: string;
    host?: string;
}

const STORAGE_DIR = '.codeinsight';
const META_FILE = 'meta.json';

export async function serveCommand(options: ServeOptions = {}): Promise<void> {
    const port = parseInt(options.port || '4747', 10);
    const host = options.host || '127.0.0.1';
    const repoPath = process.cwd();
    const storagePath = path.join(repoPath, STORAGE_DIR);
    const metaPath = path.join(storagePath, META_FILE);

    console.log(chalk.bold('\n  CodeInsight Server\n'));
    console.log(`  Repository: ${repoPath}\n`);

    try {
        await fs.access(metaPath);
    } catch {
        console.log(chalk.yellow('  No index found. Run: codeinsight analyze first\n'));
        process.exit(1);
    }

    console.log(`  Starting HTTP server on ${chalk.cyan(`http://${host}:${port}`)}\n`);
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));

    const http = await import('http');
    const url = await import('url');

    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url || '/', true);
        const pathname = parsedUrl.pathname || '/';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                version: '0.1.0',
                timestamp: new Date().toISOString(),
            }));
            return;
        }

        if (pathname === '/api/stats') {
            try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(meta.stats));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read stats' }));
            }
            return;
        }

        if (pathname === '/api/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                name: 'codeinsight',
                version: '0.1.0',
                repo: repoPath,
                endpoints: ['/health', '/api/stats', '/api/query', '/api/symbols'],
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, host, () => {
        console.log(chalk.green(`  ✓ Server running at http://${host}:${port}`));
        console.log(chalk.gray(`    Health: http://${host}:${port}/health`));
        console.log(chalk.gray(`    Stats:  http://${host}:${port}/api/stats\n`));
    });

    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n  Shutting down...'));
        server.close(() => {
            console.log(chalk.green('  Server stopped\n'));
            process.exit(0);
        });
    });
}