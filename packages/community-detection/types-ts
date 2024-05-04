import type { GraphNode, GraphEdge } from '@codeagent/core-types';

// Community node
export interface Community {
    id: string;
    label: string;
    heuristicLabel: string;
    cohesion: number;
    symbolCount: number;
    members: string[];
    keywords?: string[];
    description?: string;
}

// Community detection result
export interface CommunityResult {
    communities: Community[];
    memberships: Map<string, string>;
    stats: {
        totalCommunities: number;
        modularity: number;
        nodesProcessed: number;
        averageCohesion: number;
    };
}

// Community member with metadata
export interface CommunityMember {
    nodeId: string;
    name: string;
    kind: string;
    filePath: string;
}

// Cluster statistics
export interface ClusterStats {
    size: number;
    internalEdges: number;
    externalEdges: number;
    cohesion: number;
    density: number;
}

// Leiden algorithm configuration
export interface LeidenConfig {
    resolution?: number;
    randomness?: number;
    randomWalk?: boolean;
    maxIterations?: number;
    minCommunitySize?: number;
}