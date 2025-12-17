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
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const REGISTRY_FILE = path.join(os.homedir(), '.codeinsight', 'registry.json');

interface RegistryEntry {
    name: string;
    path: string;
    storagePath: string;
    indexedAt: string;
    lastCommit: string;
    stats: {
        files: number;
        nodes: number;
        edges: number;
        communities: number;
        processes: number;
    };
}

export async function listCommand(): Promise<void> {
    console.log(chalk.bold('\n  Indexed Repositories\n'));

    let entries: RegistryEntry[] = [];

    try {
        const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
        entries = JSON.parse(content);
    } catch {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        console.log('  Run: codeinsight analyze <path>\n');
        return;
    }

    if (entries.length === 0) {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        console.log('  Run: codeinsight analyze <path>\n');
        return;
    }

    for (const entry of entries) {
        const indexedDate = new Date(entry.indexedAt).toLocaleString();
        const stats = entry.stats || {};

        console.log(`  ${chalk.cyan(entry.name)}`);
        console.log(`    ${chalk.gray('Path:')}    ${entry.path}`);
        console.log(`    ${chalk.gray('Indexed:')} ${indexedDate}`);
        console.log(`    ${chalk.gray('Stats:')}   ${stats.files || 0} files, ${stats.nodes || 0} symbols, ${stats.edges || 0} relationships`);
        if (stats.communities) {
            console.log(`    ${chalk.gray('Communities:')} ${stats.communities}`);
        }
        if (stats.processes) {
            console.log(`    ${chalk.gray('Processes:')}  ${stats.processes}`);
        }
        console.log('');
    }

    console.log(chalk.gray(`  Total: ${entries.length} repositories\n`));
}