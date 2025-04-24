import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const GITNEXUS_DIR = '.codeagent';
const META_FILE = 'meta.json';

export async function statusCommand(): Promise<void> {
    const repoPath = process.cwd();
    const storagePath = path.join(repoPath, GITNEXUS_DIR);
    const metaPath = path.join(storagePath, META_FILE);

    console.log(chalk.bold('\n  CodeAgent Status\n'));

    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content);
        const currentCommit = await getCurrentCommit(repoPath);
        const isUpToDate = currentCommit === meta.lastCommit;

        console.log(`  Repository: ${chalk.cyan(meta.repoPath)}`);
        console.log(`  Indexed: ${new Date(meta.indexedAt).toLocaleString()}`);
        console.log(`  Indexed commit: ${chalk.gray(meta.lastCommit?.slice(0, 7) || 'unknown')}`);
        console.log(`  Current commit: ${chalk.gray(currentCommit?.slice(0, 7) || 'unknown')}`);
        console.log(`  Status: ${isUpToDate ? chalk.green('✓ up-to-date') : chalk.yellow('⚠ stale (run codeagent analyze)')}`);
        console.log('');
        console.log('  Stats:');
        console.log(`    Files: ${meta.stats.files?.toLocaleString() || 0}`);
        console.log(`    Nodes: ${meta.stats.nodes?.toLocaleString() || 0}`);
        console.log(`    Edges: ${meta.stats.edges?.toLocaleString() || 0}`);
        console.log(`    Communities: ${meta.stats.communities || 0}`);
        console.log(`    Processes: ${meta.stats.processes || 0}`);
        console.log('');

    } catch {
        console.log(chalk.yellow('  No index found. Run: codeagent analyze\n'));
    }
}

async function getCurrentCommit(repoPath: string): Promise<string> {
    try {
        const { execSync } = await import('child_process');
        return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
    } catch {
        return 'unknown';
    }
}