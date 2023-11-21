import type { LanguageId } from '@codeagent/core-types';

// Resolved import result
export interface ResolvedImport {
    /** Original import path as written in source */
    originalPath: string;
    /** Resolved absolute file path */
    resolvedPath: string | null;
    /** Whether resolution was successful */
    resolved: boolean;
    /** Resolution confidence (0-1) */
    confidence: number;
    /** Method used for resolution */
    resolutionMethod: 'relative' | 'package' | 'path-alias' | 'suffix-match' | 'fallback';
    /** Any error message if resolution failed */
    error?: string;
}

// Batch import resolution result
export interface ImportResolution {
    imports: ResolvedImport[];
    unresolved: string[];
    stats: {
        total: number;
        resolved: number;
        unresolved: number;
    };
}

// Resolution context containing file system state
export interface ResolutionContext {
    /** Current file being processed */
    currentFile: string;
    /** Root directory of the project */
    rootPath: string;
    /** All files in the project (for lookup) */
    fileIndex: FileIndexMap;
    /** Path aliases (e.g., from tsconfig.json) */
    pathAliases: Map<string, string>;
    /** Language of the current file */
    language: LanguageId;
}

// File index map structure
export interface FileIndexMap {
    /** Map of absolute paths */
    paths: Map<string, string>;
    /** Map of basename to paths (for suffix matching) */
    byBasename: Map<string, string[]>;
    /** Map of directory to files (for directory imports) */
    byDirectory: Map<string, string[]>;
    /** Map of normalized path suffixes (for fuzzy matching) */
    bySuffix: Map<string, string>;
}

// Resolution result
export interface ResolutionResult {
    resolvedPath: string | null;
    method: string;
    confidence: number;
}

// Path mapper interface
export interface PathMapper {
    mapAlias(importPath: string): string | null;
    resolveRelative(basePath: string, relativePath: string): string | null;
    resolvePackage(packageName: string, currentFile: string): string | null;
}
import type { LanguageId } from '@codeagent/core-types';

// Resolved import result
export interface ResolvedImport {
    /** Original import path as written in source */
    originalPath: string;
    /** Resolved absolute file path */
    resolvedPath: string | null;
    /** Whether resolution was successful */
    resolved: boolean;
    /** Resolution confidence (0-1) */
    confidence: number;
    /** Method used for resolution */
    resolutionMethod: 'relative' | 'package' | 'path-alias' | 'suffix-match' | 'fallback';
    /** Any error message if resolution failed */
    error?: string;
}

// Batch import resolution result
export interface ImportResolution {
    imports: ResolvedImport[];
    unresolved: string[];
    stats: {
        total: number;
        resolved: number;
        unresolved: number;
    };
}

// Resolution context containing file system state
export interface ResolutionContext {
    /** Current file being processed */
    currentFile: string;
    /** Root directory of the project */
    rootPath: string;
    /** All files in the project (for lookup) */
    fileIndex: FileIndexMap;
    /** Path aliases (e.g., from tsconfig.json) */
    pathAliases: Map<string, string>;
    /** Language of the current file */
    language: LanguageId;
}

// File index map structure
export interface FileIndexMap {
    /** Map of absolute paths */
    paths: Map<string, string>;
    /** Map of basename to paths (for suffix matching) */
    byBasename: Map<string, string[]>;
    /** Map of directory to files (for directory imports) */
    byDirectory: Map<string, string[]>;
    /** Map of normalized path suffixes (for fuzzy matching) */
    bySuffix: Map<string, string>;
}

// Resolution result
export interface ResolutionResult {
    resolvedPath: string | null;
    method: string;
    confidence: number;
}

// Path mapper interface
export interface PathMapper {
    mapAlias(importPath: string): string | null;
    resolveRelative(basePath: string, relativePath: string): string | null;
    resolvePackage(packageName: string, currentFile: string): string | null;
}