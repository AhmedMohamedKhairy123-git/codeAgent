import type { GraphStore } from '@codeagent/graph-store';

// Simplified graph representation for community detection
export class CommunityGraph {
    private nodes: Map<string, { weight: number; internalWeight: number }> = new Map();
    private edges: Map<string, Map<string, number>> = new Map();
    private totalWeight: number = 0;
    private communityWeights: Map<number, number> = new Map();
    private communitySizes: Map<number, number> = new Map();

    addNode(id: string, weight: number = 1, internalWeight: number = 0): void {
        this.nodes.set(id, { weight, internalWeight });
        if (!this.edges.has(id)) {
            this.edges.set(id, new Map());
        }
        this.totalWeight += weight;
    }

    addEdge(from: string, to: string, weight: number = 1): void {
        if (!this.nodes.has(from) || !this.nodes.has(to)) return;

        const fromEdges = this.edges.get(from)!;
        fromEdges.set(to, (fromEdges.get(to) || 0) + weight);

        const toEdges = this.edges.get(to)!;
        toEdges.set(from, (toEdges.get(from) || 0) + weight);
    }

    getNodeWeight(nodeId: string): number {
        return this.nodes.get(nodeId)?.weight || 1;
    }

    getInternalWeight(nodeId: string): number {
        return this.nodes.get(nodeId)?.internalWeight || 0;
    }

    getEdgeWeight(from: string, to: string): number {
        return this.edges.get(from)?.get(to) || 0;
    }

    getNeighbors(nodeId: string): string[] {
        return Array.from(this.edges.get(nodeId)?.keys() || []);
    }

    getDegree(nodeId: string): number {
        let degree = 0;
        for (const weight of (this.edges.get(nodeId)?.values() || [])) {
            degree += weight;
        }
        return degree;
    }

    getNodes(): string[] {
        return Array.from(this.nodes.keys());
    }

    getNodeCount(): number {
        return this.nodes.size;
    }

    getTotalWeight(): number {
        return this.totalWeight;
    }

    getCommunityWeight(communityId: number): number {
        return this.communityWeights.get(communityId) || 0;
    }

    getCommunitySize(communityId: number): number {
        return this.communitySizes.get(communityId) || 0;
    }

    setCommunityWeight(communityId: number, weight: number): void {
        this.communityWeights.set(communityId, weight);
    }

    setCommunitySize(communityId: number, size: number): void {
        this.communitySizes.set(communityId, size);
    }
}

// Build CommunityGraph from GraphStore
export function buildCommunityGraph(store: GraphStore): CommunityGraph {
    const graph = new CommunityGraph();

    // Add all nodes (only callable symbols)
    for (const [id, node] of store.nodes) {
        if (isCallable(node)) {
            graph.addNode(id);
        }
    }

    // Add edges (CALLS relationships only)
    for (const [id, edge] of store.edges) {
        if (edge.kind === 'CALLS' && graph.getNodeWeight(edge.sourceId) !== undefined && graph.getNodeWeight(edge.targetId) !== undefined) {
            graph.addEdge(edge.sourceId, edge.targetId, edge.confidence);
        }
    }

    return graph;
}

// Check if node is callable (function or method)
function isCallable(node: any): boolean {
    const callableKinds = ['Function', 'Method', 'Constructor'];
    return callableKinds.includes(node.kind);
}