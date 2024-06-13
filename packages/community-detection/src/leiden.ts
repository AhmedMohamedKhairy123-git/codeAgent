import type { GraphStore } from '@codeagent/graph-store';
import type { Community, CommunityResult, LeidenConfig } from './types.js';
import { CommunityGraph, buildCommunityGraph } from './community-graph.js';
import { aggregateClusters } from './aggregator.js';
import { generateClusterLabels } from './label-generator.js';

// Default Leiden configuration
const DEFAULT_CONFIG: Required<LeidenConfig> = {
    resolution: 1.0,
    randomness: 0.01,
    randomWalk: true,
    maxIterations: 10,
    minCommunitySize: 2,
};

export class LeidenCommunityDetector {
    private config: Required<LeidenConfig>;
    private graph: GraphStore;
    private communityGraph: CommunityGraph;
    private nodeCommunities: Map<string, number> = new Map();
    private modularity: number = 0;

    constructor(graph: GraphStore, config: LeidenConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.graph = graph;
        this.communityGraph = buildCommunityGraph(graph);
    }

    async detect(): Promise<CommunityResult> {
        // Phase 1: Initial partitioning
        await this.initialPartition();

        // Phase 2: Leiden iterations
        for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
            const moved = await this.refinePartition();
            if (!moved) break;

            await this.aggregateCommunities();
        }

        // Phase 3: Build result
        return this.buildResult();
    }

    // Initial greedy partitioning
    private async initialPartition(): Promise<void> {
        const nodes = this.communityGraph.getNodes();
        const rng = this.createRNG();

        // Each node starts in its own community
        let nextId = 0;
        for (const node of nodes) {
            this.nodeCommunities.set(node, nextId++);
        }

        let improved = true;
        while (improved) {
            improved = false;
            const shuffled = this.shuffleArray([...nodes], rng);

            for (const node of shuffled) {
                const currentComm = this.nodeCommunities.get(node)!;
                const bestMove = this.findBestMove(node);

                if (bestMove !== currentComm && bestMove !== -1) {
                    this.nodeCommunities.set(node, bestMove);
                    improved = true;
                }
            }
        }

        this.updateModularity();
    }

    // Find best community for a node
    private findBestMove(nodeId: string): number {
        const currentComm = this.nodeCommunities.get(nodeId)!;
        const neighbors = this.communityGraph.getNeighbors(nodeId);
        const nodeWeight = this.communityGraph.getNodeWeight(nodeId);

        if (neighbors.length === 0) return currentComm;

        // Calculate modularity gain for each neighbor's community
        const communityGains = new Map<number, number>();

        for (const neighbor of neighbors) {
            const neighborComm = this.nodeCommunities.get(neighbor)!;
            if (neighborComm === currentComm) continue;

            const gain = this.calculateModularityGain(nodeId, neighborComm);
            if (!communityGains.has(neighborComm) || gain > communityGains.get(neighborComm)!) {
                communityGains.set(neighborComm, gain);
            }
        }

        // Find best gain
        let bestComm = currentComm;
        let bestGain = 0;

        for (const [comm, gain] of communityGains) {
            if (gain > bestGain) {
                bestGain = gain;
                bestComm = comm;
            }
        }

        // Add randomness for exploration
        if (this.config.randomness > 0 && Math.random() < this.config.randomness) {
            const comms = Array.from(communityGains.keys());
            if (comms.length > 0) {
                return comms[Math.floor(Math.random() * comms.length)];
            }
        }

        return bestGain > 0 ? bestComm : currentComm;
    }

    // Calculate modularity gain for moving a node to a community
    private calculateModularityGain(nodeId: string, targetComm: number): number {
        const nodeWeight = this.communityGraph.getNodeWeight(nodeId);
        const totalWeight = this.communityGraph.getTotalWeight();

        // Internal edges to target community
        let internalEdges = 0;
        let externalEdges = 0;

        for (const neighbor of this.communityGraph.getNeighbors(nodeId)) {
            const neighborComm = this.nodeCommunities.get(neighbor)!;
            const edgeWeight = this.communityGraph.getEdgeWeight(nodeId, neighbor);

            if (neighborComm === targetComm) {
                internalEdges += edgeWeight;
            } else {
                externalEdges += edgeWeight;
            }
        }

        const targetWeight = this.communityGraph.getCommunityWeight(targetComm);
        const targetSize = this.communityGraph.getCommunitySize(targetComm);

        // Modularity gain formula (simplified)
        const gain = internalEdges - (targetWeight * nodeWeight) / totalWeight;

        return gain / totalWeight;
    }

    // Refine partition using Leiden's refinement phase
    private async refinePartition(): Promise<boolean> {
        let moved = false;
        const refinedCommunities = new Map<string, number>();
        const nodes = this.communityGraph.getNodes();

        for (const node of nodes) {
            const currentComm = this.nodeCommunities.get(node)!;
            const bestComm = this.findBestMove(node);

            if (bestComm !== currentComm) {
                refinedCommunities.set(node, bestComm);
                moved = true;
            } else {
                refinedCommunities.set(node, currentComm);
            }
        }

        // Apply refined assignments
        for (const [node, comm] of refinedCommunities) {
            this.nodeCommunities.set(node, comm);
        }

        return moved;
    }

    // Aggregate communities for next level (coarsening)
    private async aggregateCommunities(): Promise<void> {
        const communityNodes = new Map<number, string[]>();
        const communityWeights = new Map<number, number>();

        // Group nodes by community
        for (const [node, comm] of this.nodeCommunities) {
            if (!communityNodes.has(comm)) {
                communityNodes.set(comm, []);
            }
            communityNodes.get(comm)!.push(node);
        }

        // Create super-nodes for each community
        const superNodeMap = new Map<number, string>();
        let nextId = 0;

        for (const [comm, nodes] of communityNodes) {
            if (nodes.length >= this.config.minCommunitySize) {
                const superId = `comm_${nextId++}`;
                superNodeMap.set(comm, superId);
            }
        }

        // Build aggregated graph
        const newGraph = new CommunityGraph();

        for (const [comm, superId] of superNodeMap) {
            const nodes = communityNodes.get(comm)!;
            const internalWeight = this.calculateInternalWeight(nodes);
            newGraph.addNode(superId, nodes.length, internalWeight);
        }

        // Add edges between super-nodes
        for (const [commA, superA] of superNodeMap) {
            for (const [commB, superB] of superNodeMap) {
                if (commA >= commB) continue;

                const edgeWeight = this.calculateInterCommunityWeight(
                    communityNodes.get(commA)!,
                    communityNodes.get(commB)!
                );

                if (edgeWeight > 0) {
                    newGraph.addEdge(superA, superB, edgeWeight);
                }
            }
        }

        // Reset for next iteration
        this.communityGraph = newGraph;
        this.nodeCommunities.clear();

        // Map original nodes to new super-node communities
        for (const [comm, superId] of superNodeMap) {
            for (const node of communityNodes.get(comm)!) {
                this.nodeCommunities.set(node, parseInt(superId.split('_')[1]));
            }
        }
    }

    // Calculate total edge weight within a set of nodes
    private calculateInternalWeight(nodes: string[]): number {
        let weight = 0;
        const nodeSet = new Set(nodes);

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                weight += this.communityGraph.getEdgeWeight(nodes[i], nodes[j]);
            }
        }

        return weight;
    }

    // Calculate total edge weight between two sets of nodes
    private calculateInterCommunityWeight(nodesA: string[], nodesB: string[]): number {
        let weight = 0;

        for (const a of nodesA) {
            for (const b of nodesB) {
                weight += this.communityGraph.getEdgeWeight(a, b);
            }
        }

        return weight;
    }

    // Update modularity score
    private updateModularity(): void {
        let total = 0;
        const totalWeight = this.communityGraph.getTotalWeight();

        for (const [node, comm] of this.nodeCommunities) {
            const internalEdges = this.communityGraph.getNeighbors(node)
                .filter(n => this.nodeCommunities.get(n) === comm).length;
            const degree = this.communityGraph.getDegree(node);
            const communityDegree = this.communityGraph.getCommunityWeight(comm);

            total += internalEdges - (degree * communityDegree) / (2 * totalWeight);
        }

        this.modularity = total / (2 * totalWeight);
    }

    // Build final result
    private buildResult(): CommunityResult {
        const communityMembers = new Map<number, string[]>();

        for (const [node, comm] of this.nodeCommunities) {
            if (!communityMembers.has(comm)) {
                communityMembers.set(comm, []);
            }
            communityMembers.get(comm)!.push(node);
        }

        const communities: Community[] = [];
        const memberships = new Map<string, string>();

        for (const [commId, members] of communityMembers) {
            if (members.length < this.config.minCommunitySize) continue;

            const heuristicLabel = this.generateHeuristicLabel(members);
            const cohesion = this.calculateCohesion(members);
            const communityId = `comm_${commId}`;

            communities.push({
                id: communityId,
                label: heuristicLabel,
                heuristicLabel,
                cohesion,
                symbolCount: members.length,
                members,
            });

            for (const member of members) {
                memberships.set(member, communityId);
            }
        }

        const totalCohesion = communities.reduce((sum, c) => sum + c.cohesion, 0);
        const averageCohesion = communities.length > 0 ? totalCohesion / communities.length : 0;

        return {
            communities,
            memberships,
            stats: {
                totalCommunities: communities.length,
                modularity: this.modularity,
                nodesProcessed: this.communityGraph.getNodeCount(),
                averageCohesion,
            },
        };
    }

    // Generate heuristic label from members
    private generateHeuristicLabel(members: string[]): string {
        // Extract common file path patterns
        const pathPrefixes = new Map<string, number>();

        for (const member of members) {
            const node = this.graph.getNode(member);
            if (node?.filePath) {
                const parts = node.filePath.split('/');
                if (parts.length >= 2) {
                    const prefix = parts[parts.length - 2];
                    pathPrefixes.set(prefix, (pathPrefixes.get(prefix) || 0) + 1);
                }
            }
        }

        // Find most common prefix
        let bestPrefix = '';
        let bestCount = 0;
        for (const [prefix, count] of pathPrefixes) {
            if (count > bestCount) {
                bestCount = count;
                bestPrefix = prefix;
            }
        }

        if (bestPrefix) {
            return this.capitalize(bestPrefix);
        }

        // Fallback: use node name patterns
        const namePrefixes = new Map<string, number>();
        for (const member of members) {
            const node = this.graph.getNode(member);
            if (node?.name) {
                const prefix = node.name.split(/(?=[A-Z])/)[0];
                namePrefixes.set(prefix, (namePrefixes.get(prefix) || 0) + 1);
            }
        }

        for (const [prefix, count] of namePrefixes) {
            if (count > bestCount && prefix.length > 2) {
                bestCount = count;
                bestPrefix = prefix;
            }
        }

        return bestPrefix ? this.capitalize(bestPrefix) : `Cluster_${members.length}`;
    }

    // Calculate cohesion score (internal edge density)
    private calculateCohesion(members: string[]): number {
        if (members.length < 2) return 1.0;

        let internalEdges = 0;
        let totalEdges = 0;
        const memberSet = new Set(members);

        for (let i = 0; i < members.length; i++) {
            const neighbors = this.communityGraph.getNeighbors(members[i]);
            totalEdges += neighbors.length;

            for (const neighbor of neighbors) {
                if (memberSet.has(neighbor)) {
                    internalEdges++;
                }
            }
        }

        if (totalEdges === 0) return 1.0;
        return internalEdges / totalEdges;
    }

    // Helper: create random number generator
    private createRNG(): () => number {
        let seed = 123456789;
        return () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
    }

    // Helper: shuffle array
    private shuffleArray<T>(array: T[], rng: () => number): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Helper: capitalize string
    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }
}

// Convenience function
export async function detectCommunities(
    graph: GraphStore,
    config?: LeidenConfig
): Promise<CommunityResult> {
    const detector = new LeidenCommunityDetector(graph, config);
    return detector.detect();
}