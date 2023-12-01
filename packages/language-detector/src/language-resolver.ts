import path from 'path';
import type { LanguageId } from '@codeagent/core-types';
import type { FileIndexMap, ResolutionResult } from './types.js';
import { findFileBySuffix, findFilesInDirectory } from './file-index.js';

// Language-specific resolution strategies
export interface LanguageResolver {
    resolve(
        importPath: string,
        currentFile: string,
        fileIndex: FileIndexMap,
        rootPath: string
    ): ResolutionResult | null;
}

// JavaScript/TypeScript resolver
class JavaScriptResolver implements LanguageResolver {
    private extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    resolve(importPath: string, currentFile: string, fileIndex: FileIndexMap): ResolutionResult | null {
        // Handle relative imports (starting with . or ..)
        if (importPath.startsWith('.')) {
            const baseDir = path.dirname(currentFile);
            const resolved = path.resolve(baseDir, importPath).replace(/\\/g, '/');

            const found = findFileBySuffix(fileIndex, resolved, this.extensions);
            if (found) {
                return { resolvedPath: found, method: 'relative', confidence: 1.0 };
            }
            return null;
        }

        // Handle scoped packages (@scope/name)
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            const packageName = parts.slice(0, 2).join('/');
            const subPath = parts.slice(2).join('/');

            // This would need node_modules resolution - simplified for now
            return null;
        }

        // Handle bare imports (package names)
        // Simplified - would need node_modules resolution
        return null;
    }
}

// Python resolver
class PythonResolver implements LanguageResolver {
    private extensions = ['.py', '.pyi'];

    resolve(importPath: string, currentFile: string, fileIndex: FileIndexMap, rootPath: string): ResolutionResult | null {
        // Handle relative imports (starting with .)
        if (importPath.startsWith('.')) {
            const dotCount = importPath.match(/^\.+/)?.[0].length || 0;
            const modulePath = importPath.slice(dotCount);
            let baseDir = path.dirname(currentFile);

            for (let i = 1; i < dotCount; i++) {
                baseDir = path.dirname(baseDir);
            }

            const normalized = modulePath.replace(/\./g, '/');
            const resolved = path.join(baseDir, normalized).replace(/\\/g, '/');

            const found = findFileBySuffix(fileIndex, resolved, this.extensions);
            if (found) {
                return { resolvedPath: found, method: 'relative', confidence: 1.0 };
            }

            // Try __init__.py in directory
            const initPath = path.join(resolved, '__init__.py');
            if (fileIndex.paths.has(initPath)) {
                return { resolvedPath: initPath, method: 'relative', confidence: 0.9 };
            }

            return null;
        }

        // Handle absolute imports (from root)
        const normalized = importPath.replace(/\./g, '/');
        const resolved = path.join(rootPath, normalized).replace(/\\/g, '/');

        const found = findFileBySuffix(fileIndex, resolved, this.extensions);
        if (found) {
            return { resolvedPath: found, method: 'absolute', confidence: 0.95 };
        }

        // Try __init__.py
        const initPath = path.join(resolved, '__init__.py');
        if (fileIndex.paths.has(initPath)) {
            return { resolvedPath: initPath, method: 'absolute', confidence: 0.9 };
        }

        return null;
    }
}

// Go resolver
class GoResolver implements LanguageResolver {
    private extensions = ['.go'];

    resolve(importPath: string, currentFile: string, fileIndex: FileIndexMap, rootPath: string): ResolutionResult | null {
        // Go imports are absolute from module root
        const resolved = path.join(rootPath, importPath).replace(/\\/g, '/');
        const found = findFileBySuffix(fileIndex, resolved, this.extensions);
        if (found) {
            return { resolvedPath: found, method: 'absolute', confidence: 1.0 };
        }

        // Try directory (package import)
        const filesInDir = findFilesInDirectory(fileIndex, resolved, this.extensions);
        if (filesInDir.length > 0) {
            // Return the first file in the directory as representative
            return { resolvedPath: filesInDir[0], method: 'directory', confidence: 0.85 };
        }

        return null;
    }
}

// Rust resolver
class RustResolver implements LanguageResolver {
    private extensions = ['.rs'];

    resolve(importPath: string, currentFile: string, fileIndex: FileIndexMap, rootPath: string): ResolutionResult | null {
        // Handle crate:: imports
        if (importPath.startsWith('crate::')) {
            const modulePath = importPath.slice(7);
            const resolved = path.join(rootPath, 'src', modulePath).replace(/\\/g, '/');

            const found = findFileBySuffix(fileIndex, resolved, this.extensions);
            if (found) {
                return { resolvedPath: found, method: 'crate', confidence: 1.0 };
            }

            // Try mod.rs
            const modPath = path.join(resolved, 'mod.rs');
            if (fileIndex.paths.has(modPath)) {
                return { resolvedPath: modPath, method: 'crate', confidence: 0.95 };
            }

            return null;
        }

        // Handle super:: imports
        if (importPath.startsWith('super::')) {
            let modulePath = importPath.slice(7);
            let baseDir = path.dirname(currentFile);

            while (modulePath.startsWith('super::')) {
                baseDir = path.dirname(baseDir);
                modulePath = modulePath.slice(7);
            }

            const resolved = path.join(baseDir, modulePath).replace(/\\/g, '/');
            const found = findFileBySuffix(fileIndex, resolved, this.extensions);
            if (found) {
                return { resolvedPath: found, method: 'super', confidence: 1.0 };
            }

            return null;
        }

        // Handle self:: imports
        if (importPath.startsWith('self::')) {
            const modulePath = importPath.slice(6);
            const baseDir = path.dirname(currentFile);
            const resolved = path.join(baseDir, modulePath).replace(/\\/g, '/');

            const found = findFileBySuffix(fileIndex, resolved, this.extensions);
            if (found) {
                return { resolvedPath: found, method: 'self', confidence: 1.0 };
            }

            return null;
        }

        return null;
    }
}

// Registry of language resolvers
const resolvers: Map<LanguageId, LanguageResolver> = new Map();

export function registerLanguageResolver(language: LanguageId, resolver: LanguageResolver): void {
    resolvers.set(language, resolver);
}

export function getLanguageResolver(language: LanguageId): LanguageResolver | null {
    return resolvers.get(language) || null;
}

// Register default resolvers
registerLanguageResolver('javascript', new JavaScriptResolver());
registerLanguageResolver('typescript', new JavaScriptResolver());
registerLanguageResolver('python', new PythonResolver());
registerLanguageResolver('go', new GoResolver());
registerLanguageResolver('rust', new RustResolver());