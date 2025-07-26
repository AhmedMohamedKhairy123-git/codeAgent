import type { GraphStore, GraphNode, GraphEdge } from '@codeagent/graph-store';
import type { Process, ProcessResult, ProcessConfig, ProcessStep, EntryPointScore, TraceNode } from './types.js';

// Default configuration
const DEFAULT_CONFIG: ProcessConfig = {
    maxTraceDepth: 10,
    maxBranching: 4,
    maxProcesses: 75,
    minSteps: 3,
    minConfidence: 0.5,
};

// Score multipliers
const EXPORT_MULTIPLIER = 2.0;
const NAME_PATTERN_MULTIPLIER = 1.5;
const UTILITY_PENALTY = 0.3;

// Entry point name patterns
const ENTRY_PATTERNS = [
    /^(main|init|bootstrap|start|run|setup|configure)$/i,
    /^handle[A-Z]/,
    /^on[A-Z]/,
    /Handler$/,
    /Controller$/,
    /^process[A-Z]/,
    /^execute[A-Z]/,
    /^perform[A-Z]/,
    /^dispatch[A-Z]/,
    /^trigger[A-Z]/,
    /^emit[A-Z]/,
    /^use[A-Z]/,
    /^app$/,
    /^view_/,
    /^do[A-Z]/,
    /Service$/,
];

// Utility patterns (penalize these)
const UTILITY_PATTERNS = [
    /^(get|set|is|has|can|should|will|did)[A-Z]/,
    /^_/,
    /^(format|parse|validate|convert|transform)/i,
    /^(log|debug|error|warn|info)$/i,
    /^(to|from)[A-Z]/,
    /Helper$/,
    /Util$/,
    /Utils$/,
];

// Test file patterns
const TEST_FILE_PATTERNS = [
    /\.test\./,
    /\.spec\./,
    /__tests__/,
    /__mocks__/,
    /\/test\//,
    /\/tests\//,
    /_test\.py$/,
    /_test\.go$/,
    /_spec\.rb$/,
    /Test\.java$/,
    /Tests\.cs$/,
];

function isTestFile(filePath: string): boolean {
    return TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scoreEntryPoint(node: GraphNode, callers: string[], callees: string[]): EntryPointScore {
    const reasons: string[] = [];

    if (callees.length === 0) {
        return { nodeId: node.id, score: 0, reasons: ['no-outgoing-calls'] };
    }

    const baseScore = callees.length / (callers.length + 1);
    reasons.push(`base:${baseScore.toFixed(2)}`);

    let score = baseScore;
    if (node.isExported) {
        score *= EXPORT_MULTIPLIER;
        reasons.push('exported');
    }

    const name = node.name;
    let nameMultiplier = 1.0;

    if (UTILITY_PATTERNS.some(p => p.test(name))) {
        nameMultiplier = UTILITY_PENALTY;
        reasons.push('utility-pattern');
    } else if (ENTRY_PATTERNS.some(p => p.test(name))) {
        nameMultiplier = NAME_PATTERN_MULTIPLIER;
        reasons.push('entry-pattern');
    }

    score *= nameMultiplier;

    if (node.filePath && (node.filePath.includes('/pages/') || node.filePath.includes('/app/') || node.filePath.endsWith('views.py'))) {
        score *= 2.0;
        reasons.push('framework');
    }

    return { nodeId: node.id, score, reasons };
}

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

    private buildCallGraph(): void {
        for (const [_, edge] of this.graph.edges) {
            if (edge.kind === 'CALLS' && edge.confidence >= this.config.minConfidence) {
                if (!this.callGraph.has(edge.sourceId)) {
                    this.callGraph.set(edge.sourceId, []);
                }
                this.callGraph.get(edge.sourceId)!.push(edge.targetId);

                if (!this.reverseCallGraph.has(edge.targetId)) {
                    this.reverseCallGraph.set(edge.targetId, []);
                }
                this.reverseCallGraph.get(edge.targetId)!.push(edge.sourceId);
            }
        }

        for (const [id, node] of this.graph.nodes) {
            this.nodeMap.set(id, node);
        }
    }

    private findEntryPoints(): EntryPointScore[] {
        const candidates: EntryPointScore[] = [];

        for (const [id, node] of this.graph.nodes) {
            if (node.kind !== 'Function' && node.kind !== 'Method') continue;

            if (isTestFile(node.filePath)) continue;

            const callers = this.reverseCallGraph.get(id) || [];
            const callees = this.callGraph.get(id) || [];

            const score = scoreEntryPoint(node, callers, callees);
            if (score.score > 0) {
                candidates.push(score);
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, 200);
    }

    private buildTrace(entryId: string): string[][] {
        const traces: string[][] = [];
        const queue: TraceNode[] = [{ id: entryId, depth: 0, path: [entryId] }];
        const visited = new Set<string>();
        let tracesFound = 0;

        while (queue.length > 0 && tracesFound < this.config.maxBranching * 3) {
            const current = queue.shift()!;

            if (visited.has(current.id) && current.depth > 0) continue;
            visited.add(current.id);

            const callees = this.callGraph.get(current.id) || [];

            if (callees.length === 0) {
                if (current.path.length >= this.config.minSteps) {
                    traces.push([...current.path]);
                    tracesFound++;
                }
            } else if (current.depth >= this.config.maxTraceDepth) {
                if (current.path.length >= this.config.minSteps) {
                    traces.push([...current.path]);
                    tracesFound++;
                }
            } else {
                const limitedCallees = callees.slice(0, this.config.maxBranching);
                let added = false;

                for (const callee of limitedCallees) {
                    if (!current.path.includes(callee)) {
                        queue.push({
                            id: callee,
                            depth: current.depth + 1,
                            path: [...current.path, callee],
                        });
                        added = true;
                    }
                }

                if (!added && current.path.length >= this.config.minSteps) {
                    traces.push([...current.path]);
                    tracesFound++;
                }
            }
        }

        return traces;
    }

    private deduplicateTraces(traces: string[][]): string[][] {
        if (traces.length === 0) return [];

        const sorted = [...traces].sort((a, b) => b.length - a.length);
        const unique: string[][] = [];

        for (const trace of sorted) {
            const traceKey = trace.join('->');
            const isSubset = unique.some(existing => existing.join('->').includes(traceKey));
            if (!isSubset) {
                unique.push(trace);
            }
        }

        return unique;
    }

    private deduplicateByEndpoints(traces: string[][]): string[][] {
        const byEndpoint = new Map<string, string[]>();
        const sorted = [...traces].sort((a, b) => b.length - a.length);

        for (const trace of sorted) {
            const key = `${trace[0]}::${trace[trace.length - 1]}`;
            if (!byEndpoint.has(key)) {
                byEndpoint.set(key, trace);
            }
        }

        return Array.from(byEndpoint.values());
    }

    private generateProcessLabel(trace: string[]): string {
        if (trace.length === 0) return 'Empty Process';

        const entryNode = this.nodeMap.get(trace[0]);
        const terminalNode = this.nodeMap.get(trace[trace.length - 1]);

        const entryName = entryNode?.name || 'Unknown';
        const terminalName = terminalNode?.name || 'Unknown';

        return `${entryName} → ${terminalName}`;
    }

    private sanitizeProcessId(name: string): string {
        return name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30).toLowerCase();
    }

    private collectTraceCommunities(trace: string[], membershipMap: Map<string, string>): string[] {
        const communities = new Set<string>();
        for (const nodeId of trace) {
            const communityId = membershipMap.get(nodeId);
            if (communityId) {
                communities.add(communityId);
            }
        }
        return Array.from(communities);
    }

    private buildMembershipMap(): Map<string, string> {
        const membershipMap = new Map<string, string>();
        for (const [_, edge] of this.graph.edges) {
            if (edge.kind === 'MEMBER_OF') {
                membershipMap.set(edge.sourceId, edge.targetId);
            }
        }
        return membershipMap;
    }

    async detect(): Promise<ProcessResult> {
        const entryPoints = this.findEntryPoints();
        const allTraces: string[][] = [];

        for (const entry of entryPoints.slice(0, this.config.maxProcesses * 2)) {
            const traces = this.buildTrace(entry.nodeId);
            const filtered = traces.filter(t => t.length >= this.config.minSteps);
            allTraces.push(...filtered);
        }

        const deduped = this.deduplicateTraces(allTraces);
        const endpointDeduped = this.deduplicateByEndpoints(deduped);
        const limitedTraces = endpointDeduped
            .sort((a, b) => b.length - a.length)
            .slice(0, this.config.maxProcesses);

        return this.createProcesses(limitedTraces);
    }

    private createProcesses(traces: string[][]): ProcessResult {
        const processes: Process[] = [];
        const steps: ProcessStep[] = [];
        const membershipMap = this.buildMembershipMap();

        for (let idx = 0; idx < traces.length; idx++) {
            const trace = traces[idx];
            const entryPointId = trace[0];
            const terminalId = trace[trace.length - 1];
            const communities = this.collectTraceCommunities(trace, membershipMap);
            const processType = communities.length > 1 ? 'cross_community' : 'intra_community';
            const heuristicLabel = this.generateProcessLabel(trace);
            const processId = `proc_${idx}_${this.sanitizeProcessId(heuristicLabel)}`;

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

            trace.forEach((nodeId, stepIdx) => {
                steps.push({
                    nodeId,
                    processId,
                    step: stepIdx + 1,
                });
            });
        }

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
}

export async function detectProcesses(
    graph: GraphStore,
    config?: Partial<ProcessConfig>
): Promise<ProcessResult> {
    const detector = new ProcessDetector(graph, config);
    return detector.detect();
}