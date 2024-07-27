import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphStore } from '@codeagent/graph-store';
import { LeidenCommunityDetector, detectCommunities } from './leiden.js';
import { CommunityGraph, buildCommunityGraph } from './community-graph.js';
import { aggregateClusters, calculateCohesion } from './aggregator.js';

describe('CommunityDetection', () => {
    let graph: ReturnType<typeof createGraphStore>;

    beforeEach(() => {
        graph = createGraphStore();

        // Create a simple graph with 3 clusters
        // Cluster A: nodes a1, a2, a3 (connected)
        // Cluster B: nodes b1, b2, b3 (connected)
        // Cluster C: nodes c1, c2 (connected)
        // Cross-cluster edges: a1-b1, b2-c1

        const nodes = [
            { id: 'a1', kind: 'Function', name: 'func1', filePath: 'src/a/file1.ts' },
            { id: 'a2', kind: 'Function', name: 'func2', filePath: 'src/a/file2.ts' },
            { id: 'a3', kind: 'Function', name: 'func3', filePath: 'src/a/file3.ts' },
            { id: 'b1', kind: 'Function', name: 'func4', filePath: 'src/b/file1.ts' },
            { id: 'b2', kind: 'Function', name: 'func5', filePath: 'src/b/file2.ts' },
            { id: 'b3', kind: 'Function', name: 'func6', filePath: 'src/b/file3.ts' },
            { id: 'c1', kind: 'Function', name: 'func7', filePath: 'src/c/file1.ts' },
            { id: 'c2', kind: 'Function', name: 'func8', filePath: 'src/c/file2.ts' },
        ];

        for (const node of nodes) {
            graph = graph.addNode(node);
        }

        // Cluster A edges
        graph = graph.addEdge({ id: 'e1', sourceId: 'a1', targetId: 'a2', kind: 'CALLS', confidence: 1.0 });
        graph = graph.addEdge({ id: 'e2', sourceId: 'a2', targetId: 'a3', kind: 'CALLS', confidence: 1.0 });
        graph = graph.addEdge({ id: 'e3', sourceId: 'a3', targetId: 'a1', kind: 'CALLS', confidence: 1.0 });

        // Cluster B edges
        graph = graph.addEdge({ id: 'e4', sourceId: 'b1', targetId: 'b2', kind: 'CALLS', confidence: 1.0 });
        graph = graph.addEdge({ id: 'e5', sourceId: 'b2', targetId: 'b3', kind: 'CALLS', confidence: 1.0 });

        // Cluster C edges
        graph = graph.addEdge({ id: 'e6', sourceId: 'c1', targetId: 'c2', kind: 'CALLS', confidence: 1.0 });

        // Cross-cluster edges
        graph = graph.addEdge({ id: 'e7', sourceId: 'a1', targetId: 'b1', kind: 'CALLS', confidence: 0.5 });
        graph = graph.addEdge({ id: 'e8', sourceId: 'b2', targetId: 'c1', kind: 'CALLS', confidence: 0.3 });
    });

    describe('LeidenCommunityDetector', () => {
        it('detects communities', async () => {
            const detector = new LeidenCommunityDetector(graph);
            const result = await detector.detect();

            expect(result.communities.length).toBeGreaterThanOrEqual(2);
            expect(result.stats.totalCommunities).toBeGreaterThan(0);
            expect(result.stats.modularity).toBeGreaterThanOrEqual(-1);
        });

        it('returns community memberships', async () => {
            const result = await detectCommunities(graph);

            expect(result.memberships.size).toBe(8);
            for (const [nodeId, communityId] of result.memberships) {
                expect(nodeId).toBeDefined();
                expect(communityId).toMatch(/^comm_\d+$/);
            }
        });

        it('calculates cohesion for communities', async () => {
            const result = await detectCommunities(graph);

            for (const community of result.communities) {
                expect(community.cohesion).toBeGreaterThanOrEqual(0);
                expect(community.cohesion).toBeLessThanOrEqual(1);
            }
        });

        it('generates heuristic labels', async () => {
            const result = await detectCommunities(graph);

            for (const community of result.communities) {
                expect(community.heuristicLabel).toBeDefined();
                expect(community.heuristicLabel.length).toBeGreaterThan(0);
            }
        });
    });

    describe('CommunityGraph', () => {
        it('builds graph from store', () => {
            const communityGraph = buildCommunityGraph(graph);
            expect(communityGraph.getNodeCount()).toBe(8);
        });

        it('tracks node weights', () => {
            const communityGraph = buildCommunityGraph(graph);
            expect(communityGraph.getNodeWeight('a1')).toBe(1);
        });

        it('tracks edges', () => {
            const communityGraph = buildCommunityGraph(graph);
            expect(communityGraph.getNeighbors('a1')).toContain('a2');
            expect(communityGraph.getEdgeWeight('a1', 'a2')).toBe(1);
        });
    });

    describe('Aggregator', () => {
        it('calculates cohesion', async () => {
            const result = await detectCommunities(graph);
            const edgeMap = new Map<string, Map<string, number>>();

            for (const [id, edge] of graph.edges) {
                if (!edgeMap.has(edge.sourceId)) {
                    edgeMap.set(edge.sourceId, new Map());
                }
                edgeMap.get(edge.sourceId)!.set(edge.targetId, edge.confidence);
            }

            for (const community of result.communities) {
                const cohesion = calculateCohesion(community.members, edgeMap);
                expect(cohesion).toBe(community.cohesion);
            }
        });

        it('aggregates similar clusters', async () => {
            const result = await detectCommunities(graph);
            const aggregated = aggregateClusters(result.communities, 0.2);

            expect(aggregated.length).toBeLessThanOrEqual(result.communities.length);
        });
    });
});