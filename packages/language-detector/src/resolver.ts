import path from 'path';
import { detectLanguage } from '@codeagent/language-detector';
import { createFileIndex, findFileBySuffix } from './file-index.js';
import { createPathMapper } from './path-mapper.js';
import { getLanguageResolver } from './language-resolver.js';
import type { ResolvedImport, ImportResolution, ResolutionContext, ResolutionResult } from './types.js';

// Common file extensions for each language
const EXTENSIONS: Record<string, string[]> = {
    javascript: ['.js', '.jsx', '.mjs', '.cjs'],
    typescript: ['.ts', '.tsx', '.mts', '.cts'],
    python: ['.py', '.pyi'],
    java: ['.java'],
    go: ['.go'],
    rust: ['.rs'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx'],
    csharp: ['.cs'],
    php: ['.php', '.phtml'],
    ruby: ['.rb', '.rake'],
    swift: ['.swift'],
    kotlin: ['.kt', '.kts'],
};

// Default extensions to try when language is unknown
const DEFAULT_EXTENSIONS = ['.js', '.ts', '.py', '.go', '.rs'];

export class ImportResolver {
    private fileIndex: ReturnType<typeof createFileIndex>;
    private rootPath: string;
    private pathMapper: ReturnType<typeof createPathMapper>;
    private aliases: Map<string, string>;

    constructor(files: string[], rootPath: string, aliases: Map<string, string> = new Map()) {
        this.rootPath = rootPath;
        this.aliases = aliases;
        this.fileIndex = createFileIndex(files, rootPath);
        this.pathMapper = createPathMapper(aliases, rootPath);
    }

    async resolve(
        importPath: string,
        currentFile: string,
        language?: string
    ): Promise<ResolvedImport> {
        const lang = language || detectLanguage(currentFile).language;
        const extensions = EXTENSIONS[lang] || DEFAULT_EXTENSIONS;

        // Try each resolution strategy in order
        const strategies = [
            () => this.resolveAlias(importPath),
            () => this.resolveRelative(importPath, currentFile, extensions),
            () => this.resolvePackage(importPath, currentFile),
            () => this.resolveLanguageSpecific(importPath, currentFile, lang, extensions),
            () => this.resolveSuffixMatch(importPath, extensions),
        ];

        for (const strategy of strategies) {
            const result = strategy();
            if (result && result.resolvedPath) {
                return {
                    originalPath: importPath,
                    resolvedPath: result.resolvedPath,
                    resolved: true,
                    confidence: result.confidence,
                    resolutionMethod: result.method as any,
                };
            }
        }

        // Resolution failed
        return {
            originalPath: importPath,
            resolvedPath: null,
            resolved: false,
            confidence: 0,
            resolutionMethod: 'fallback',
            error: `Could not resolve import: ${importPath}`,
        };
    }

    async resolveBatch(
        imports: string[],
        currentFile: string,
        language?: string
    ): Promise<ImportResolution> {
        const results: ResolvedImport[] = [];
        const unresolved: string[] = [];

        for (const importPath of imports) {
            const resolved = await this.resolve(importPath, currentFile, language);
            results.push(resolved);
            if (!resolved.resolved) {
                unresolved.push(importPath);
            }
        }

        return {
            imports: results,
            unresolved,
            stats: {
                total: imports.length,
                resolved: results.filter(r => r.resolved).length,
                unresolved: unresolved.length,
            },
        };
    }

    private resolveAlias(importPath: string): ResolutionResult | null {
        const aliased = this.pathMapper.mapAlias(importPath);
        if (!aliased) return null;

        const resolved = path.resolve(this.rootPath, aliased).replace(/\\/g, '/');
        return { resolvedPath: resolved, method: 'path-alias', confidence: 0.95 };
    }

    private resolveRelative(
        importPath: string,
        currentFile: string,
        extensions: string[]
    ): ResolutionResult | null {
        if (!importPath.startsWith('.')) return null;

        const baseDir = path.dirname(currentFile);
        const resolved = path.resolve(baseDir, importPath).replace(/\\/g, '/');
        const found = findFileBySuffix(this.fileIndex, resolved, extensions);

        if (found) {
            return { resolvedPath: found, method: 'relative', confidence: 1.0 };
        }

        return null;
    }

    private resolvePackage(importPath: string, currentFile: string): ResolutionResult | null {
        if (importPath.startsWith('.') || importPath.startsWith('/')) return null;

        const packageName = importPath.split('/')[0];
        const resolved = this.pathMapper.resolvePackage(packageName, currentFile);

        if (resolved) {
            // Handle subpaths
            const subPath = importPath.slice(packageName.length);
            const fullPath = subPath ? path.join(resolved, subPath) : resolved;
            return { resolvedPath: fullPath.replace(/\\/g, '/'), method: 'package', confidence: 0.9 };
        }

        return null;
    }

    private resolveLanguageSpecific(
        importPath: string,
        currentFile: string,
        language: string,
        extensions: string[]
    ): ResolutionResult | null {
        const resolver = getLanguageResolver(language as any);
        if (!resolver) return null;

        return resolver.resolve(importPath, currentFile, this.fileIndex, this.rootPath);
    }

    private resolveSuffixMatch(importPath: string, extensions: string[]): ResolutionResult | null {
        const normalized = importPath.replace(/\\/g, '/');
        const found = findFileBySuffix(this.fileIndex, normalized, extensions);

        if (found) {
            return { resolvedPath: found, method: 'suffix-match', confidence: 0.7 };
        }

        return null;
    }
}

// Convenience function
export async function resolveImport(
    importPath: string,
    currentFile: string,
    files: string[],
    rootPath: string,
    aliases?: Map<string, string>
): Promise<ResolvedImport> {
    const resolver = new ImportResolver(files, rootPath, aliases);
    return resolver.resolve(importPath, currentFile);
}

// Batch resolve
export async function resolveImportsBatch(
    imports: string[],
    currentFile: string,
    files: string[],
    rootPath: string,
    aliases?: Map<string, string>
): Promise<ImportResolution> {
    const resolver = new ImportResolver(files, rootPath, aliases);
    return resolver.resolveBatch(imports, currentFile);
}