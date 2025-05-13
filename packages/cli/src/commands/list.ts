import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const GLOBAL_REGISTRY = path.join(os.homedir(), '.codeagent', 'registry.json');

export async function listCommand(): Promise<void> {
    console.log(chalk.bold('\n  Indexed Repositories\n'));

    let entries: any[] = [];
    try {
        const content = await fs.readFile(GLOBAL_REGISTRY, 'utf-8');
        entries = JSON.parse(content);
    } catch {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        console.log('  Run: codeagent analyze\n');
        return;
    }

    if (entries.length === 0) {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        console.log('  Run: codeagent analyze\n');
        return;
    }

    for (const entry of entries) {
        const indexedDate = new Date(entry.indexedAt).toLocaleString();
        const stats = entry.stats || {};

        console.log(`  ${chalk.cyan(entry.name)}`);
        console.log(`    Path:    ${entry.path}`);
        console.log(`    Indexed: ${indexedDate}`);
        console.log(`    Stats:   ${stats.files || 0} files, ${stats.nodes || 0} nodes, ${stats.edges || 0} edges`);
        if (stats.communities) console.log(`    Communities: ${stats.communities}`);
        if (stats.processes) console.log(`    Processes:  ${stats.processes}`);
        console.log('');
    }
}