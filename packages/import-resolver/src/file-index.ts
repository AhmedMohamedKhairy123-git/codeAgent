import path from 'path';
import type { FileIndexMap } from './types.js';

// Create file index from list of files
export function createFileIndex(files: string[], rootPath: string): FileIndexMap {
    const index: FileIndexMap = {
        paths: new Map(),
        byBasename: new Map(),
        byDirectory: new Map(),
        bySuffix: new Map(),
    };

    for (const file of files) {
        const absolutePath = path.resolve(rootPath, file);
        const normalized = absolutePath.replace(/\\/g, '/');
        const basename = path.basename(file);
        const dirname = path.dirname(file);
        const extension = path.extname(file);

        // Store by full path
        index.paths.set(normalized, normalized);
        index.paths.set(file, normalized);
        index.paths.set(basename, normalized);

        // Store by basename
        if (!index.byBasename.has(basename)) {
            index.byBasename.set(basename, []);
        }
        index.byBasename.get(basename)!.push(normalized);

        // Store by directory
        if (!index.byDirectory.has(dirname)) {
            index.byDirectory.set(dirname, []);
        }
        index.byDirectory.get(dirname)!.push(normalized);

        // Build suffix index for fuzzy matching
        const parts = normalized.split('/');
        for (let i = 0; i < parts.length; i++) {
            const suffix = parts.slice(i).join('/');
            if (!index.bySuffix.has(suffix)) {
                index.bySuffix.set(suffix, normalized);
            }
        }
    }

    return index;
}

// Find file by exact path or suffix match
export function findFileBySuffix(
    index: FileIndexMap,
    targetPath: string,
    extensions: string[]
): string | null {
    // Normalize target path
    let normalized = targetPath.replace(/\\/g, '/');
    const originalNormalized = normalized;

    // Try exact match first
    if (index.paths.has(normalized)) {
        return index.paths.get(normalized)!;
    }

    // Try with each extension
    for (const ext of extensions) {
        const withExt = normalized + ext;
        if (index.paths.has(withExt)) {
            return index.paths.get(withExt)!;
        }
    }

    // Try index file patterns
    for (const ext of extensions) {
        const indexPath = path.join(normalized, 'index' + ext);
        if (index.paths.has(indexPath)) {
            return index.paths.get(indexPath)!;
        }
    }

    // Try suffix matching
    const suffixPattern = originalNormalized;
    for (const [suffix, filePath] of index.bySuffix) {
        if (suffix === suffixPattern || suffix.endsWith('/' + suffixPattern)) {
            return filePath;
        }
    }

    return null;
}

// Find all files in a directory
export function findFilesInDirectory(
    index: FileIndexMap,
    directory: string,
    extensions?: string[]
): string[] {
    const files = index.byDirectory.get(directory) || [];

    if (extensions) {
        return files.filter(f => extensions.some(ext => f.endsWith(ext)));
    }

    return files;
}

// Check if a file exists in the index
export function fileExists(index: FileIndexMap, filePath: string): boolean {
    const normalized = path.resolve(filePath).replace(/\\/g, '/');
    return index.paths.has(normalized);
}