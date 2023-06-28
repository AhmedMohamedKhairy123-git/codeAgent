import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { walkDirectory, FileWalker } from './walker.js';
import { IgnorePatterns, isBinaryContent } from './ignore.js';

describe('FileWalker', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(os.tmpdir(), `codeagent-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });

        // Create test files
        await fs.writeFile(path.join(testDir, 'file1.js'), 'console.log("hello");');
        await fs.writeFile(path.join(testDir, 'file2.ts'), 'const x: number = 5;');
        await fs.mkdir(path.join(testDir, 'subdir'));
        await fs.writeFile(path.join(testDir, 'subdir', 'file3.py'), 'print("hello")');
        await fs.writeFile(path.join(testDir, 'subdir', 'file4.txt'), 'plain text');
        await fs.writeFile(path.join(testDir, '.gitignore'), '*.txt');
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('walk', () => {
        it('discovers all files without content', async () => {
            const result = await walkDirectory(testDir, { readContent: false });

            expect(result.totalFiles).toBe(4); // file1.js, file2.ts, file3.py, file4.txt
            expect(result.files).toHaveLength(0); // No content read
            expect(result.errors).toHaveLength(0);
        });

        it('reads file contents when specified', async () => {
            const result = await walkDirectory(testDir, { readContent: true });

            expect(result.files).toHaveLength(3); // file4.txt is ignored by .gitignore
            expect(result.files.some(f => f.path === 'file1.js')).toBe(true);
            expect(result.files.some(f => f.path === 'file2.ts')).toBe(true);
            expect(result.files.some(f => f.path === 'subdir/file3.py')).toBe(true);

            const jsFile = result.files.find(f => f.path === 'file1.js');
            expect(jsFile?.content).toBe('console.log("hello");');
        });

        it('respects max depth', async () => {
            const result = await walkDirectory(testDir, { readContent: false, maxDepth: 0 });

            expect(result.totalFiles).toBe(2); // Only root files
            expect(result.files).toHaveLength(0);
        });

        it('respects max file size', async () => {
            const result = await walkDirectory(testDir, {
                readContent: true,
                maxFileSize: 10, // Very small
            });

            expect(result.skippedFiles).toBeGreaterThan(0);
        });
    });

    describe('IgnorePatterns', () => {
        it('ignores patterns from array', () => {
            const patterns = new IgnorePatterns(['*.log', 'temp/']);
            expect(patterns.ignores('error.log')).toBe(true);
            expect(patterns.ignores('temp/cache.txt')).toBe(true);
            expect(patterns.ignores('src/main.js')).toBe(false);
        });

        it('adds patterns from .gitignore content', () => {
            const patterns = new IgnorePatterns();
            patterns.addFromFile('*.tmp\n*.bak\n# comment');
            expect(patterns.ignores('test.tmp')).toBe(true);
            expect(patterns.ignores('backup.bak')).toBe(true);
            expect(patterns.ignores('source.js')).toBe(false);
        });

        it('includes default patterns', () => {
            const patterns = new IgnorePatterns();
            expect(patterns.ignores('node_modules/react/index.js')).toBe(true);
            expect(patterns.ignores('dist/bundle.js')).toBe(true);
            expect(patterns.ignores('.git/HEAD')).toBe(true);
        });
    });

    describe('isBinaryContent', () => {
        it('detects null bytes as binary', () => {
            const binary = Buffer.from([0x00, 0x01, 0x02]).toString('binary');
            expect(isBinaryContent(Buffer.from(binary))).toBe(true);
        });

        it('detects text as not binary', () => {
            const text = Buffer.from('console.log("hello");');
            expect(isBinaryContent(text)).toBe(false);
        });

        it('detects high ratio of non-printable as binary', () => {
            const nonPrintable = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
            expect(isBinaryContent(nonPrintable)).toBe(true);
        });
    });
});