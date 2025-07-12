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
