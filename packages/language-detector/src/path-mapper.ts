import path from 'path';

// Path mapper for handling aliases and path resolution
export interface PathMapper {
    mapAlias(importPath: string): string | null;
    resolveRelative(basePath: string, relativePath: string): string | null;
    resolvePackage(packageName: string, currentFile: string): string | null;
}

// Create a path mapper with alias configuration
export function createPathMapper(
    aliases: Map<string, string>,
    rootPath: string,
    nodeModulesPath?: string
): PathMapper {
    const nodeModules = nodeModulesPath || path.join(rootPath, 'node_modules');

    return {
        mapAlias(importPath: string): string | null {
            for (const [alias, target] of aliases) {
                if (importPath === alias || importPath.startsWith(alias + '/')) {
                    const relative = importPath.slice(alias.length);
                    return path.join(target, relative);
                }
            }
            return null;
        },

        resolveRelative(basePath: string, relativePath: string): string | null {
            if (!relativePath.startsWith('.')) {
                return null;
            }

            const resolved = path.resolve(path.dirname(basePath), relativePath);
            return resolved.replace(/\\/g, '/');
        },

        resolvePackage(packageName: string, currentFile: string): string | null {
            // Try to find package in node_modules
            const packagePath = path.join(nodeModules, packageName);
            const indexPath = path.join(packagePath, 'index.js');
            const packageJsonPath = path.join(packagePath, 'package.json');

            // Check if package exists
            try {
                const fs = require('fs');
                if (fs.existsSync(packagePath)) {
                    // If package.json exists, try to resolve main entry
                    if (fs.existsSync(packageJsonPath)) {
                        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                        const main = pkg.main || 'index.js';
                        const mainPath = path.join(packagePath, main);
                        if (fs.existsSync(mainPath)) {
                            return mainPath.replace(/\\/g, '/');
                        }
                    }
                    // Fallback to index.js
                    if (fs.existsSync(indexPath)) {
                        return indexPath.replace(/\\/g, '/');
                    }
                    return packagePath.replace(/\\/g, '/');
                }
            } catch {
                // Package doesn't exist
            }

            return null;
        },
    };
}

// Resolve a path alias (simple function version)
export function resolvePathAlias(
    importPath: string,
    aliases: Map<string, string>
): string | null {
    for (const [alias, target] of aliases) {
        if (importPath === alias || importPath.startsWith(alias + '/')) {
            const relative = importPath.slice(alias.length);
            return path.join(target, relative);
        }
    }
    return null;
}