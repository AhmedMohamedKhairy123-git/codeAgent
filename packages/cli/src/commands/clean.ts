import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import readline from 'readline';

const GITNEXUS_DIR = '.codeagent';
const GLOBAL_REGISTRY = path.join(os.homedir(), '.codeagent', 'registry.json');

export interface CleanOptions {
    force?: boolean;
    all?: boolean;
}

export async function cleanCommand(options?: CleanOptions): Promise<void> {
    console.log(chalk.bold('\n  CodeAgent Clean\n'));

    if (options?.all) {
        await cleanAll(options);
    } else {
        await cleanCurrent(options);
    }
}

async function cleanCurrent(options?: CleanOptions): Promise<void> {
    const repoPath = process.cwd();
    const storagePath = path.join(repoPath, GITNEXUS_DIR);

    // Check if index exists
    try {
        await fs.access(storagePath);
    } catch {
        console.log(chalk.yellow('  No index found in this repository.\n'));
        return;
    }

    if (!options?.force) {
        const answer = await prompt(`  Delete index for ${path.basename(repoPath)}? (y/N) `);
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.yellow('  Cancelled.\n'));
            return;
        }
    }

    try {
        await fs.rm(storagePath, { recursive: true, force: true });
        await unregisterRepo(repoPath);
        console.log(chalk.green(`  Deleted: ${storagePath}\n`));
    } catch (error) {
        console.error(chalk.red(`  Failed to delete: ${error}\n`));
    }
}

async function cleanAll(options?: CleanOptions): Promise<void> {
    let entries: any[] = [];
    try {
        const content = await fs.readFile(GLOBAL_REGISTRY, 'utf-8');
        entries = JSON.parse(content);
    } catch {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        return;
    }

    if (entries.length === 0) {
        console.log(chalk.yellow('  No indexed repositories found.\n'));
        return;
    }

    if (!options?.force) {
        console.log('  This will delete indexes for:');
        for (const entry of entries) {
            console.log(`    - ${entry.name} (${entry.path})`);
        }
        const answer = await prompt('  Continue? (y/N) ');
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.yellow('  Cancelled.\n'));
            return;
        }
    }

    for (const entry of entries) {
        try {
            await fs.rm(entry.storagePath, { recursive: true, force: true });
            console.log(chalk.green(`  Deleted: ${entry.name}`));
        } catch (error) {
            console.error(chalk.red(`  Failed to delete ${entry.name}: ${error}`));
        }
    }

    try {
        await fs.rm(path.dirname(GLOBAL_REGISTRY), { recursive: true, force: true });
    } catch {
        // Ignore
    }

    console.log('');
}

async function unregisterRepo(repoPath: string): Promise<void> {
    try {
        const content = await fs.readFile(GLOBAL_REGISTRY, 'utf-8');
        let entries = JSON.parse(content);
        const resolved = path.resolve(repoPath);
        entries = entries.filter((e: any) => path.resolve(e.path) !== resolved);
        await fs.writeFile(GLOBAL_REGISTRY, JSON.stringify(entries, null, 2), 'utf-8');
    } catch {
        // Registry doesn't exist
    }
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}