import fs from 'fs/promises';
import path from 'path';
import ignore, { Ignore } from 'ignore';

// Default patterns to always ignore (security + common noise)
const DEFAULT_IGNORE_PATTERNS = [
    // Version control
    '.git',
    '.svn',
    '.hg',
    '.bzr',

    // Dependencies
    'node_modules',
    'bower_components',
    'vendor',
    'venv',
    '.venv',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.cargo',

    // Build outputs
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    '.output',
    '.vercel',
    '.netlify',

    // IDE
    '.idea',
    '.vscode',
    '.vs',
    '.DS_Store',
    'Thumbs.db',

    // Logs and temp
    'logs',
    'log',
    'tmp',
    'temp',
    '.cache',
    '.turbo',

    // Generated
    '.generated',
    'generated',
    'coverage',
    '.nyc_output',
    '.coverage',

    // Lock files (binary)
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'go.sum',
    'composer.lock',

    // Binary extensions
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.ico',
    '*.webp',
    '*.mp4',
    '*.mp3',
    '*.wav',
    '*.mov',
    '*.pdf',
    '*.doc',
    '*.docx',
    '*.xls',
    '*.xlsx',
    '*.zip',
    '*.tar',
    '*.gz',
    '*.rar',
    '*.7z',
    '*.exe',
    '*.dll',
    '*.so',
    '*.dylib',
    '*.class',
    '*.jar',
    '*.war',
    '*.pyc',
    '*.pyo',
    '*.wasm',
    '*.bin',
    '*.dat',
];

// Binary file detection (first 8KB)
const BINARY_SIGNATURES = [
    Buffer.from([0x00]), // Null byte
    Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
    Buffer.from([0x89, 0x50, 0x4E, 0x47]), // PNG
    Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF
];

export class IgnorePatterns {
    private ig: Ignore;
    private patterns: string[];

    constructor(patterns: string[] = []) {
        this.patterns = [...DEFAULT_IGNORE_PATTERNS, ...patterns];
        this.ig = ignore().add(this.patterns);
    }

    add(pattern: string): void {
        this.patterns.push(pattern);
        this.ig.add(pattern);
    }

    addFromFile(content: string): void {
        const lines = content.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));
        for (const line of lines) {
            this.add(line);
        }
    }

    ignores(filePath: string): boolean {
        return this.ig.ignores(filePath);
    }

    getPatterns(): string[] {
        return [...this.patterns];
    }
}

// Create ignore filter from repository root
export async function loadIgnoreFiles(
    rootPath: string,
    options: { useGitignore?: boolean; ignoreFileName?: string } = {}
): Promise<IgnorePatterns> {
    const patterns = new IgnorePatterns();
    const { useGitignore = true, ignoreFileName = '.gitignore' } = options;

    // Load .gitignore if exists
    if (useGitignore) {
        try {
            const gitignorePath = path.join(rootPath, '.gitignore');
            const content = await fs.readFile(gitignorePath, 'utf-8');
            patterns.addFromFile(content);
        } catch {
            // .gitignore doesn't exist, ignore
        }
    }

    // Load custom ignore file
    if (ignoreFileName) {
        try {
            const customPath = path.join(rootPath, ignoreFileName);
            const content = await fs.readFile(customPath, 'utf-8');
            patterns.addFromFile(content);
        } catch {
            // Custom ignore file doesn't exist
        }
    }

    return patterns;
}

// Create ignore filter from pattern array
export function createIgnoreFilter(patterns: string[]): IgnorePatterns {
    return new IgnorePatterns(patterns);
}

// Check if content appears to be binary
export function isBinaryContent(buffer: Buffer, sampleSize: number = 8192): boolean {
    const sample = buffer.length < sampleSize ? buffer : buffer.subarray(0, sampleSize);

    // Check for null bytes (strong indicator of binary)
    if (sample.includes(0)) {
        return true;
    }

    // Check for common binary signatures
    for (const sig of BINARY_SIGNATURES) {
        if (sample.length >= sig.length && sample.subarray(0, sig.length).equals(sig)) {
            return true;
        }
    }

    // Check ratio of non-printable characters
    let nonPrintable = 0;
    for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        // Printable ASCII range: 32-126, plus newline (10), carriage return (13), tab (9)
        if (byte < 9 || (byte > 13 && byte < 32) || byte > 126) {
            nonPrintable++;
        }
    }

    const ratio = nonPrintable / sample.length;
    return ratio > 0.1; // More than 10% non-printable = binary
}