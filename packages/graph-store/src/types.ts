import type { GraphNode, GraphEdge, KnowledgeGraph } from '@codeagent/core-types';

// Immutable graph state
export interface GraphSnapshot {
    readonly nodes: ReadonlyMap<string, GraphNode>;
    readonly edges: ReadonlyMap<string, GraphEdge>;
    readonly outgoingEdges: ReadonlyMap<string, Set<string>>;
    readonly incomingEdges: ReadonlyMap<string, Set<string>>;
}

// Change set for tracking modifications
export interface GraphDiff {
    addedNodes: GraphNode[];
    removedNodes: string[];
    addedEdges: GraphEdge[];
    removedEdges: string[];
    updatedNodes: Map<string, GraphNode>;
    updatedEdges: Map<string, GraphEdge>;
}

// Query filter for nodes
export interface NodeFilter {
    kind?: string | string[];
    filePath?: string | RegExp;
    name?: string | RegExp;
    isExported?: boolean;
    language?: string;
}

// Query filter for edges
export interface EdgeFilter {
    kind?: string | string[];
    sourceId?: string;
    targetId?: string;
    minConfidence?: number;
}