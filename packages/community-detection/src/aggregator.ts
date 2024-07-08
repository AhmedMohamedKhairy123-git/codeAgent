import type { Community, CommunityResult, ClusterStats } from './types.js';

// Aggregate clusters (merge similar communities)
export function aggregateClusters(
    communities: Community[],
    minSimilarity: number = 0.3,
    maxMergeSize: number = 10
): Community[] {
    const aggregated: Community[] = [];
    const merged = new Set<string>();

    for (let i = 0; i < communities.length; i++) {
        if (merged.has(communities[i].id)) continue;

        let current = { ...communities[i] };
        const candidates: Community[] = [];

        for (let j = i + 1; j < communities.length; j++) {
            if (merged.has(communities[j].id)) continue;

            const similarity = calculateSimilarity(current, communities[j]);
            if (similarity >= minSimilarity && current.symbolCount + communities[j].symbolCount <= maxMergeSize) {
                candidates.push(communities[j]);
            }
        }

        if (candidates.length > 0) {
            // Merge candidates into current
            for (const candidate of candidates) {
                current = mergeCommunities(current, candidate);
                merged.add(candidate.id);
            }
            aggregated.push(current);
        } else {
            aggregated.push(current);
        }
    }

    return aggregated;
}

// Calculate similarity between two communities
function calculateSimilarity(a: Community, b: Community): number {
    if (a.symbolCount === 0 || b.symbolCount === 0) return 0;

    const commonMembers = a.members.filter(m => b.members.includes(m)).length;
    const totalMembers = a.symbolCount + b.symbolCount;

    // Jaccard similarity
    return commonMembers / (totalMembers - commonMembers);
}

// Merge two communities
function mergeCommunities(a: Community, b: Community): Community {
    const allMembers = [...new Set([...a.members, ...b.members])];
    const totalSymbols = a.symbolCount + b.symbolCount;

    // Weighted average cohesion
    const cohesion = (a.cohesion * a.symbolCount + b.cohesion * b.symbolCount) / totalSymbols;

    return {
        id: a.id,
        label: a.label, // Keep first label
        heuristicLabel: a.heuristicLabel,
        cohesion,
        symbolCount: totalSymbols,
        members: allMembers,
    };
}

// Calculate cohesion for a set of nodes
export function calculateCohesion(
    members: string[],
    edgeWeightMap: Map<string, Map<string, number>>
): number {
    if (members.length < 2) return 1.0;

    let internalEdges = 0;
    let totalEdges = 0;
    const memberSet = new Set(members);

    for (let i = 0; i < members.length; i++) {
        const edges = edgeWeightMap.get(members[i]) || new Map();
        totalEdges += edges.size;

        for (const neighbor of edges.keys()) {
            if (memberSet.has(neighbor)) {
                internalEdges++;
            }
        }
    }

    if (totalEdges === 0) return 1.0;
    return internalEdges / totalEdges;
}

// Calculate cluster statistics
export function calculateClusterStats(
    members: string[],
    edgeWeightMap: Map<string, Map<string, number>>
): ClusterStats {
    let internalEdges = 0;
    let externalEdges = 0;
    const memberSet = new Set(members);

    for (const member of members) {
        const edges = edgeWeightMap.get(member) || new Map();
        for (const [neighbor, weight] of edges) {
            if (memberSet.has(neighbor)) {
                internalEdges += weight;
            } else {
                externalEdges += weight;
            }
        }
    }

    const totalPossibleEdges = members.length * (members.length - 1);
    const density = totalPossibleEdges > 0 ? (internalEdges * 2) / totalPossibleEdges : 0;
    const cohesion = internalEdges / (internalEdges + externalEdges + 1);

    return {
        size: members.length,
        internalEdges,
        externalEdges,
        cohesion,
        density,
    };
}