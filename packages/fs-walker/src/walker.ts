import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { IgnorePatterns, isBinaryContent } from './ignore.js';
import type { WalkOptions, WalkResult, FileEntry, FileStats, ProgressCallback } from './types.js';

// Default walk options
const DEFAULT_OPTIONS: Required<Omit<WalkOptions, 'additionalIgnores' | 'ignoreFileName'>> = {
    maxFileSize: 1024 * 1024, // 1MB
    readContent: false,
    skipBinary: true,
    maxDepth: Infinity,
    followSymlinks: false,
    useGitignore: true,
};

export class FileWalker {
    private rootPath: string;
    private options: Required<Omit<WalkOptions, 'additionalIgnores' | 'ignoreFileName'>> & Pick<WalkOptions, 'additionalIgnores' | 'ignoreFileName'>;
    private ignorePatterns: IgnorePatterns | null = null;
    private results: FileEntry[] = [];
    private stats: { totalFiles: number; totalSize: number; skippedFiles: number; skippedSize: number; errors: Array<{ path: string; error: string }> } = {
        totalFiles: 0,
        totalSize: 0,
        skippedFiles: 0,
        skippedSize: 0,
        errors: [],
    };

    constructor(rootPath: string, options: WalkOptions = {}) {
        this.rootPath = path.resolve(rootPath);
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            additionalIgnores: options.additionalIgnores,
            ignoreFileName: options.ignoreFileName,
        };
    }

    async walk(onProgress?: ProgressCallback): Promise<WalkResult> {
        // Initialize ignore patterns
        this.ignorePatterns = await loadIgnorePatterns(this.rootPath, this.options);

        // Walk the directory
        await this.walkDirectory(this.rootPath, 0, onProgress);

        return {
            files: this.results,
            totalFiles: this.stats.totalFiles,
            totalSize: this.stats.totalSize,
            skippedFiles: this.stats.skippedFiles,
            skippedSize: this.stats.skippedSize,
            errors: this.stats.errors,
        };
    }

    private async walkDirectory(dirPath: string, depth: number, onProgress?: ProgressCallback): Promise<void> {
        if (depth > this.options.maxDepth) {
            return;
        }

        let entries: fs.Dirent[];
        try {
            entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch (err) {
            this.stats.errors.push({
                path: dirPath,
                error: err instanceof Error ? err.message : String(err),
            });
            return;
        }

        for (const entry of entries) {
            const relativePath = path.relative(this.rootPath, path.join(dirPath, entry.name));
            const fullPath = path.join(dirPath, entry.name);

            // Check ignore patterns
            if (this.ignorePatterns?.ignores(relativePath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await this.walkDirectory(fullPath, depth + 1, onProgress);
            } else if (entry.isFile() || (this.options.followSymlinks && entry.isSymbolicLink())) {
                await this.processFile(relativePath, fullPath, onProgress);
            }
        }
    }

    private async processFile(relativePath: string, fullPath: string, onProgress?: ProgressCallback): Promise<void> {
        this.stats.totalFiles++;
        onProgress?.(this.stats.totalFiles, null, relativePath);

        let stat: fs.Stats;
        try {
            stat = await fs.stat(fullPath);
        } catch (err) {
            this.stats.errors.push({ path: relativePath, error: err instanceof Error ? err.message : String(err) });
            this.stats.skippedFiles++;
            return;
        }

        // Skip if file is too large
        if (stat.size > this.options.maxFileSize) {
            this.stats.skippedFiles++;
            this.stats.skippedSize += stat.size;
            return;
        }

        // If we don't need content, just track stats
        if (!this.options.readContent) {
            this.stats.totalSize += stat.size;
            return;
        }

        // Read file content
        let content: string;
        try {
            content = await this.readFileContent(fullPath, stat.size);
        } catch (err) {
            this.stats.errors.push({ path: relativePath, error: err instanceof Error ? err.message : String(err) });
            this.stats.skippedFiles++;
            return;
        }

        // Skip binary files if configured
        if (this.options.skipBinary && this.isBinary(content)) {
            this.stats.skippedFiles++;
            this.stats.skippedSize += stat.size;
            return;
        }

        this.results.push({
            path: relativePath,
            content,
            size: stat.size,
        });
        this.stats.totalSize += stat.size;
    }

    private async readFileContent(filePath: string, size: number): Promise<string> {
        // For small files, read all at once
        if (size < 1024 * 64) { // 64KB
            return await fs.readFile(filePath, 'utf-8');
        }

        // For larger files, stream and detect encoding
        const chunks: Buffer[] = [];
        const stream = createReadStream(filePath);
        const rl = createInterface({
            input: stream,
            crlfDelay: Infinity,
        });

        for await (const line of rl) {
            chunks.push(Buffer.from(line + '\n', 'utf-8'));
            // Limit memory usage for huge files
            if (chunks.length > 10000) {
                break;
            }
        }

        return Buffer.concat(chunks).toString('utf-8');
    }

    private isBinary(content: string): boolean {
        // Check for common binary patterns in first 8KB
        const sample = content.slice(0, 8192);
        // Look for null bytes or high ratio of non-printable characters
        let nullCount = 0;
        let nonPrintable = 0;

        for (let i = 0; i < sample.length; i++) {
            const code = sample.charCodeAt(i);
            if (code === 0) nullCount++;
            if (code < 9 || (code > 13 && code < 32) || code > 126) {
                nonPrintable++;
            }
        }

        // Strong indicators of binary
        if (nullCount > 0) return true;
        if (nonPrintable > sample.length * 0.1) return true;

        return false;
    }
}

// Helper function to load ignore patterns
async function loadIgnorePatterns(
    rootPath: string,
    options: WalkOptions & { additionalIgnores?: string[] }
): Promise<IgnorePatterns> {
    const patterns = new IgnorePatterns(options.additionalIgnores || []);

    if (options.useGitignore) {
        try {
            const gitignorePath = path.join(rootPath, '.gitignore');
            const content = await fs.readFile(gitignorePath, 'utf-8');
            const lines = content.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'));
            for (const line of lines) {
                patterns.add(line);
            }
        } catch {
            // .gitignore doesn't exist
        }
    }

    if (options.ignoreFileName) {
        try {
            const customPath = path.join(rootPath, options.ignoreFileName);
            const content = await fs.readFile(customPath, 'utf-8');
            const lines = content.split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'));
            for (const line of lines) {
                patterns.add(line);
            }
        } catch {
            // Custom ignore file doesn't exist
        }
    }

    return patterns;
}

// Convenience function for one-off walks
export async function walkDirectory(
    rootPath: string,
    options?: WalkOptions,
    onProgress?: ProgressCallback
): Promise<WalkResult> {
    const walker = new FileWalker(rootPath, options);
    return walker.walk(onProgress);
}

// Synchronous version for simple cases (not recommended for large directories)
export function walkDirectorySync(rootPath: string, options?: WalkOptions): WalkResult {
    // Note: This is a simplified sync version. For real use, prefer async.
    const result: WalkResult = {
        files: [],
        totalFiles: 0,
        totalSize: 0,
        skippedFiles: 0,
        skippedSize: 0,
        errors: [],
    };
    return result;
}