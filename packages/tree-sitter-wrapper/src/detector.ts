import type { GraphStore, GraphNode, GraphEdge } from '@codeagent/graph-store';
import type { Process, ProcessResult, ProcessConfig, ProcessStep } from './types.js';
import { findEntryPoints, scoreEntryPoint } from './entry-point-scorer.js';
import { buildTrace, deduplicateTraces, deduplicateByEndpoints } from './trace-builder.js';
import { generateProcessLabel, sanitizeProcessId, determineProcessType, collectTraceCommunities } from './process-labeler.js';

// Default configuration
const DEFAULT_CONFIG: ProcessConfig = {
    maxTraceDepth: 10,
    maxBranching: 4,
    maxProcesses: 75,
    minSteps: 3,
    minConfidence: 0.5,
};

export class ProcessDetector {
    private graph: GraphStore;
    private config: ProcessConfig;
    private callGraph: Map<string, string[]> = new Map();
    private reverseCallGraph: Map<string, string[]> = new Map();
    private nodeMap: Map<string, GraphNode> = new Map();

    constructor(graph: GraphStore, config: Partial<ProcessConfig> = {}) {
        this.graph = graph;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.buildCallGraph();
    }

    // Build call graph from graph store
    private buildCallGraph(): void {
        for (const [id, edge] of this.graph.edges) {
            if (edge.kind === 'CALLS' && edge.confidence >= this.config.minConfidence) {
                // Forward graph
                if (!this.callGraph.has(edge.sourceId)) {
                    this.callGraph.set(edge.sourceId, []);
                }
                this.callGraph.get(edge.sourceId)!.push(edge.targetId);

                // Reverse graph
                if (!this.reverseCallGraph.has(edge.targetId)) {
                    this.reverseCallGraph.set(edge.targetId, []);
                }
                this.reverseCallGraph.get(edge.targetId)!.push(edge.sourceId);
            }
        }

        // Populate node map
        for (const [id, node] of this.graph.nodes) {
            this.nodeMap.set(id, node);
        }
    }

    // Detect processes
    async detect(): Promise<ProcessResult> {
        // Step 1: Find entry points
        const entryPoints = this.findEntryPoints();

        // Step 2: Trace from each entry point
        const allTraces: string[][] = [];

        for (const entry of entryPoints.slice(0, this.config.maxProcesses * 2)) {
            const traces = buildTrace(entry.nodeId, this.callGraph, this.nodeMap, this.config);
            const filtered = traces.filter(t => t.length >= this.config.minSteps);
            allTraces.push(...filtered);
        }

        // Step 3: Deduplicate traces
        const deduped = deduplicateTraces(allTraces);
        const endpointDeduped = deduplicateByEndpoints(deduped);

        // Step 4: Limit to max processes
        const limitedTraces = endpointDeduped
            .sort((a, b) => b.length - a.length)
            .slice(0, this.config.maxProcesses);

        // Step 5: Create process nodes
        return this.createProcesses(limitedTraces);
    }

    // Find entry points with scoring
    private findEntryPoints(): { nodeId: string; score: number }[] {
        const candidates: { nodeId: string; score: number; reasons: string[] }[] = [];

        for (const [id, node] of this.graph.nodes) {
            if (node.kind !== 'Function' && node.kind !== 'Method') continue;

            const callers = this.reverseCallGraph.get(id) || [];
            const callees = this.callGraph.get(id) || [];

            const score = scoreEntryPoint(node, callers.map(c => ({ sourceId: c, targetId: id } as GraphEdge)), callees.map(c => ({ sourceId: id, targetId: c } as GraphEdge)));

            if (score.score > 0) {
                candidates.push(score);
            }
        }

        // Sort by score descending
        candidates.sort((a, b) => b.score - a.score);

        return candidates.slice(0, 200);
    }

    // Create process nodes from traces
    private createProcesses(traces: string[][]): ProcessResult {
        const processes: Process[] = [];
        const steps: ProcessStep[] = [];

        // Build membership map (from community detection)
        const membershipMap = this.buildMembershipMap();

        for (let idx = 0; idx < traces.length; idx++) {
            const trace = traces[idx];
            const entryPointId = trace[0];
            const terminalId = trace[trace.length - 1];

            // Collect communities touched
            const communities = collectTraceCommunities(trace, membershipMap);

            // Determine process type
            const processType = determineProcessType(communities, membershipMap);

            // Generate label
            const heuristicLabel = generateProcessLabel(trace, this.nodeMap);
            const processId = `proc_${idx}_${sanitizeProcessId(heuristicLabel)}`;

            processes.push({
                id: processId,
                label: heuristicLabel,
                heuristicLabel,
                processType,
                stepCount: trace.length,
                communities,
                entryPointId,
                terminalId,
                trace,
            });

            // Create step relationships
            trace.forEach((nodeId, stepIdx) => {
                steps.push({
                    nodeId,
                    processId,
                    step: stepIdx + 1,
                });
            });
        }

        // Calculate stats
        const crossCommunityCount = processes.filter(p => p.processType === 'cross_community').length;
        const avgStepCount = processes.length > 0
            ? processes.reduce((sum, p) => sum + p.stepCount, 0) / processes.length
            : 0;

        return {
            processes,
            steps,
            stats: {
                totalProcesses: processes.length,
                crossCommunityCount,
                avgStepCount: Math.round(avgStepCount * 10) / 10,
                entryPointsFound: this.reverseCallGraph.size,
            },
        };
    }

    // Build membership map from community detection
    private buildMembershipMap(): Map<string, string> {
        const membershipMap = new Map<string, string>();

        // Find MEMBER_OF edges
        for (const [id, edge] of this.graph.edges) {
            if (edge.kind === 'MEMBER_OF') {
                membershipMap.set(edge.sourceId, edge.targetId);
            }
        }

        return membershipMap;
    }
}

// Convenience function
export async function detectProcesses(
    graph: GraphStore,
    config?: Partial<ProcessConfig>
): Promise<ProcessResult> {
    const detector = new ProcessDetector(graph, config);
    return detector.detect();
}