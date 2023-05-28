// File entry with content (for reading)
export interface FileEntry {
    path: string;
    content: string;
    size: number;
}

// File stats without content (for scanning)
export interface FileStats {
    path: string;
    size: number;
    isBinary: boolean;
    modifiedAt: Date;
}

// Walk configuration options
export interface WalkOptions {
    /** Maximum file size to read (bytes). Default: 1MB */
    maxFileSize?: number;
    /** Whether to read file contents. Default: false */
    readContent?: boolean;
    /** Whether to detect binary files and skip them. Default: true */
    skipBinary?: boolean;
    /** Maximum depth to traverse. Default: Infinity */
    maxDepth?: number;
    /** Whether to follow symlinks. Default: false */
    followSymlinks?: boolean;
    /** Custom ignore patterns (in addition to .gitignore) */
    additionalIgnores?: string[];
    /** Whether to use .gitignore rules. Default: true */
    useGitignore?: boolean;
    /** Custom ignore file path (default: .gitignore) */
    ignoreFileName?: string;
}

// Walk result
export interface WalkResult {
    files: FileEntry[];
    totalFiles: number;
    totalSize: number;
    skippedFiles: number;
    skippedSize: number;
    errors: WalkError[];
}

// Walk error
export interface WalkError {
    path: string;
    error: string;
}

// Progress callback
export type ProgressCallback = (current: number, total: number | null, filePath: string) => void;