import type { Community } from './types.js';

// Generate cluster labels based on member patterns
export function generateClusterLabels(
    communities: Community[],
    filePathMap: Map<string, string>,
    nameMap: Map<string, string>
): Community[] {
    return communities.map(community => ({
        ...community,
        heuristicLabel: generateLabel(community, filePathMap, nameMap),
    }));
}

// Generate a single label
function generateLabel(
    community: Community,
    filePathMap: Map<string, string>,
    nameMap: Map<string, string>
): string {
    // Try to find common directory
    const dirCounts = new Map<string, number>();
    for (const member of community.members) {
        const filePath = filePathMap.get(member);
        if (filePath) {
            const parts = filePath.split('/');
            if (parts.length >= 2) {
                const dir = parts[parts.length - 2];
                dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
            }
        }
    }

    let bestDir = '';
    let bestCount = 0;
    for (const [dir, count] of dirCounts) {
        if (count > bestCount && !isGenericDir(dir)) {
            bestCount = count;
            bestDir = dir;
        }
    }

    if (bestDir) {
        return capitalize(bestDir);
    }

    // Try to find common name prefix
    const nameCounts = new Map<string, number>();
    for (const member of community.members) {
        const name = nameMap.get(member);
        if (name) {
            const prefix = extractPrefix(name);
            if (prefix.length > 2) {
                nameCounts.set(prefix, (nameCounts.get(prefix) || 0) + 1);
            }
        }
    }

    for (const [prefix, count] of nameCounts) {
        if (count > bestCount) {
            bestCount = count;
            bestDir = prefix;
        }
    }

    if (bestDir) {
        return capitalize(bestDir);
    }

    // Fallback: use size-based label
    return `Cluster_${community.symbolCount}`;
}

// Extract common prefix from name
function extractPrefix(name: string): string {
    // Split by camelCase or underscore
    const parts = name.split(/(?=[A-Z])|_/);
    return parts[0] || name;
}

// Check if directory is generic
function isGenericDir(dir: string): boolean {
    const generic = ['src', 'lib', 'core', 'utils', 'common', 'shared', 'helpers', 'internal'];
    return generic.includes(dir.toLowerCase());
}

// Capitalize string
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}