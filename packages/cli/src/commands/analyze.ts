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