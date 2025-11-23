import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { runPipeline } from '@codeagent/ingestion-pipeline';
import type { PipelineProgress } from '@codeagent/ingestion-pipeline';

export interface AnalyzeOptions {
    force?: boolean;
    embeddings?: boolean;
    skipEmbeddings?: boolean;
    skills?: boolean;
    verbose?: boolean;
}

// Storage paths
const GITNEXUS_DIR = '.codeagent';
const META_FILE = 'meta.json';

interface RepoMeta {
    repoPath: string;
    lastCommit: string;
    indexedAt: string;
    stats: {
        files: number;
        nodes: number;
        edges: number;
        communities: number;
        processes: number;
        embeddings: number;
    };
}

export async function analyzeCommand(
    inputPath?: string,
    options?: AnalyzeOptions
): Promise<void> {
    const repoPath = inputPath ? path.resolve(inputPath) : process.cwd();
    const storagePath = path.join(repoPath, GITNEXUS_DIR);
    const metaPath = path.join(storagePath, META_FILE);

    console.log(chalk.bold('\n  CodeAgent Analyzer\n'));

    // Check if already indexed
    let existingMeta: RepoMeta | null = null;
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        existingMeta = JSON.parse(content);

        if (!options?.force && existingMeta) {
            console.log(chalk.yellow('  Already up to date. Use --force to re-index.\n'));
            return;
        }
    } catch {
        // No existing index
    }

    const spinner = ora('Scanning repository...').start();

    try {
        // Run pipeline with progress
        const progressBar = new cliProgress.SingleBar({
            format: '  {bar} {percentage}% | {phase}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
        });

        let lastPhase = '';
        progressBar.start(100, 0, { phase: 'Initializing...' });

        const result = await runPipeline(
            repoPath,
            (progress: PipelineProgress) => {
                const displayPhase = progress.detail
                    ? `${progress.message} (${progress.detail})`
                    : progress.message;

                if (displayPhase !== lastPhase) {
                    lastPhase = displayPhase;
                    progressBar.update(progress.percent, { phase: displayPhase });
                } else {
                    progressBar.update(progress.percent, { phase: displayPhase });
                }
            },
            {
                enableCommunities: true,
                enableProcesses: true,
                maxFileSize: 1024 * 1024,
                skipBinary: true,
            }
        );

        progressBar.stop();

        // Save metadata
        const meta: RepoMeta = {
            repoPath,
            lastCommit: await getCurrentCommit(repoPath),
            indexedAt: new Date().toISOString(),
            stats: {
                files: result.stats.totalFiles,
                nodes: result.stats.totalNodes,
                edges: result.stats.totalEdges,
                communities: result.stats.totalCommunities,
                processes: result.stats.totalProcesses,
                embeddings: 0,
            },
        };

        await fs.mkdir(storagePath, { recursive: true });
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        // Print summary
        console.log(chalk.green(`\n  Repository indexed successfully (${result.stats.duration.toFixed(1)}s)\n`));
        console.log(`  ${result.stats.totalNodes.toLocaleString()} nodes | ${result.stats.totalEdges.toLocaleString()} edges`);
        console.log(`  ${result.stats.totalCommunities} communities | ${result.stats.totalProcesses} processes`);
        console.log(`  ${result.stats.totalFiles} files`);
        console.log(`  ${repoPath}\n`);

        if (existingMeta) {
            console.log(chalk.cyan('  Index updated successfully.\n'));
        }

    } catch (error) {
        spinner.fail('Failed to index repository');
        console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : String(error)}\n`));
        process.exit(1);
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
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { runPipeline } from '@codeagent/ingestion-pipeline';
import type { PipelineProgress } from '@codeagent/ingestion-pipeline';

export interface AnalyzeOptions {
    force?: boolean;
    embeddings?: boolean;
    skipEmbeddings?: boolean;
    skills?: boolean;
    verbose?: boolean;
    output?: string;
}

const STORAGE_DIR = '.codeinsight';
const META_FILE = 'meta.json';
const REGISTRY_FILE = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.codeinsight', 'registry.json');

interface RepoMeta {
    repoPath: string;
    lastCommit: string;
    indexedAt: string;
    stats: {
        files: number;
        nodes: number;
        edges: number;
        communities: number;
        processes: number;
        embeddings: number;
    };
}

async function getCurrentCommit(repoPath: string): Promise<string> {
    try {
        const { execSync } = await import('child_process');
        return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
    } catch {
        return 'unknown';
    }
}

async function updateRegistry(meta: RepoMeta): Promise<void> {
    try {
        await fs.mkdir(path.dirname(REGISTRY_FILE), { recursive: true });
        let entries: any[] = [];

        try {
            const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
            entries = JSON.parse(content);
        } catch {
            // Registry doesn't exist yet
        }

        const existingIndex = entries.findIndex(e => path.resolve(e.path) === path.resolve(meta.repoPath));
        const entry = {
            name: path.basename(meta.repoPath),
            path: meta.repoPath,
            storagePath: path.join(meta.repoPath, STORAGE_DIR),
            indexedAt: meta.indexedAt,
            lastCommit: meta.lastCommit,
            stats: meta.stats,
        };

        if (existingIndex >= 0) {
            entries[existingIndex] = entry;
        } else {
            entries.push(entry);
        }

        await fs.writeFile(REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
        console.warn('Failed to update registry:', error);
    }
}

export async function analyzeCommand(
    inputPath?: string,
    options: AnalyzeOptions = {}
): Promise<void> {
    const repoPath = inputPath ? path.resolve(inputPath) : process.cwd();
    const storagePath = path.join(repoPath, STORAGE_DIR);
    const metaPath = path.join(storagePath, META_FILE);

    console.log(chalk.bold('\n  CodeInsight Analyzer\n'));
    console.log(chalk.gray(`  Repository: ${repoPath}\n`));

    let existingMeta: RepoMeta | null = null;
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        existingMeta = JSON.parse(content);

        if (!options.force && existingMeta) {
            const currentCommit = await getCurrentCommit(repoPath);
            if (currentCommit === existingMeta.lastCommit) {
                console.log(chalk.yellow('  ✓ Already up to date. Use --force to re-index.\n'));
                return;
            }
            console.log(chalk.cyan('  Repository changed, updating index...\n'));
        }
    } catch {
        // No existing index
    }

    const spinner = ora('Scanning repository...').start();

    try {
        const progressBar = new cliProgress.SingleBar({
            format: '  {bar} {percentage}% | {phase}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            clearOnComplete: false,
        });

        let lastPhase = '';
        progressBar.start(100, 0, { phase: 'Initializing...' });

        const result = await runPipeline(
            repoPath,
            (progress: PipelineProgress) => {
                const displayPhase = progress.detail
                    ? `${progress.message} (${progress.detail})`
                    : progress.message;

                if (displayPhase !== lastPhase) {
                    lastPhase = displayPhase;
                    progressBar.update(progress.percent, { phase: displayPhase.slice(0, 50) });
                } else {
                    progressBar.update(progress.percent, { phase: displayPhase.slice(0, 50) });
                }
            },
            {
                enableCommunities: true,
                enableProcesses: true,
                maxFileSize: 1024 * 1024,
                skipBinary: true,
            }
        );

        progressBar.stop();
        console.log('');

        const meta: RepoMeta = {
            repoPath,
            lastCommit: await getCurrentCommit(repoPath),
            indexedAt: new Date().toISOString(),
            stats: {
                files: result.stats.totalFiles,
                nodes: result.stats.totalNodes,
                edges: result.stats.totalEdges,
                communities: result.stats.totalCommunities,
                processes: result.stats.totalProcesses,
                embeddings: 0,
            },
        };

        await fs.mkdir(storagePath, { recursive: true });
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        if (options.skills) {
            const skillsPath = path.join(storagePath, 'skills');
            await fs.mkdir(skillsPath, { recursive: true });
            await generateSkillFiles(result, skillsPath);
        }

        await updateRegistry(meta);

        console.log(chalk.green(`\n  ✓ Repository indexed successfully (${result.stats.duration.toFixed(1)}s)\n`));
        console.log(`  ${chalk.cyan('Stats:')}`);
        console.log(`    Files:    ${result.stats.totalFiles.toLocaleString()}`);
        console.log(`    Nodes:    ${result.stats.totalNodes.toLocaleString()}`);
        console.log(`    Edges:    ${result.stats.totalEdges.toLocaleString()}`);
        console.log(`    Communities: ${result.stats.totalCommunities}`);
        console.log(`    Processes:   ${result.stats.totalProcesses}`);
        console.log(`\n  ${chalk.gray(storagePath)}\n`);

        if (options.embeddings) {
            console.log(chalk.cyan('  Embeddings generation enabled - run `codeagent embed` to generate\n'));
        }
    } catch (error) {
        spinner.fail('Failed to index repository');
        console.error(chalk.red(`\n  Error: ${error instanceof Error ? error.message : String(error)}\n`));
        if (options.verbose && error instanceof Error && error.stack) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}

async function generateSkillFiles(result: any, outputPath: string): Promise<void> {
    const skills: string[] = [];

    if (result.communityResult?.communities) {
        for (const community of result.communityResult.communities.slice(0, 10)) {
            skills.push(`# ${community.label}\n`);
            skills.push(`## Description\nCommunity of ${community.symbolCount} related functions\n`);
            skills.push(`## Members\n`);
            for (const member of community.members.slice(0, 20)) {
                const node = result.graph.getNode(member);
                if (node) {
                    skills.push(`- ${node.name} (${node.kind}) in ${path.basename(node.filePath)}`);
                }
            }
            skills.push('\n---\n');
        }
    }

    if (result.processResult?.processes) {
        for (const process of result.processResult.processes.slice(0, 10)) {
            skills.push(`# ${process.label}\n`);
            skills.push(`## Type: ${process.processType}\n`);
            skills.push(`## Steps: ${process.stepCount}\n`);
            skills.push(`## Trace:\n`);
            for (let i = 0; i < process.trace.length; i++) {
                const node = result.graph.getNode(process.trace[i]);
                if (node) {
                    skills.push(`${i + 1}. ${node.name} (${node.kind})`);
                }
            }
            skills.push('\n---\n');
        }
    }

    await fs.writeFile(path.join(outputPath, 'skills.md'), skills.join('\n'), 'utf-8');
}