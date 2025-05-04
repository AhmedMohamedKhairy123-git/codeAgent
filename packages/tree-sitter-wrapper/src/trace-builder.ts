import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import type { TraceNode, ProcessConfig } from './types.js';

// Default configuration
const DEFAULT_CONFIG: ProcessConfig = {
    maxTraceDepth: 10,
    maxBranching: 4,
    maxProcesses: 75,
    minSteps: 3,
    minConfidence: 0.5,
};

export class TraceBuilder {
    private config: ProcessConfig;
    private callGraph: Map<string, string[]>;
    private nodeMap: Map<string, GraphNode>;
    private traces: string[][] = [];

    constructor(
        callGraph: Map<string, string[]>,
        nodeMap: Map<string, GraphNode>,
        config: Partial<ProcessConfig> = {}
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.callGraph = callGraph;
        this.nodeMap = nodeMap;
    }

    // Build traces from an entry point
    buildTraces(entryId: string): string[][] {
        this.traces = [];
        this.bfsTrace(entryId);
        return this.traces;
    }

    // BFS trace from entry point
    private bfsTrace(entryId: string): void {
        const queue: TraceNode[] = [{ id: entryId, depth: 0, path: [entryId] }];
        const visited = new Set<string>();
        let tracesFound = 0;

        while (queue.length > 0 && tracesFound < this.config.maxBranching * 3) {
            const current = queue.shift()!;

            if (visited.has(current.id) && current.depth > 0) continue;
            visited.add(current.id);

            const callees = this.callGraph.get(current.id) || [];

            if (callees.length === 0) {
                // Terminal node - record trace
                if (current.path.length >= this.config.minSteps) {
                    this.traces.push([...current.path]);
                    tracesFound++;
                }
            } else if (current.depth >= this.config.maxTraceDepth) {
                // Max depth reached - record what we have
                if (current.path.length >= this.config.minSteps) {
                    this.traces.push([...current.path]);
                    tracesFound++;
                }
            } else {
                // Continue tracing with branching limit
                const limitedCallees = callees.slice(0, this.config.maxBranching);
                let added = false;

                for (const callee of limitedCallees) {
                    // Avoid cycles
                    if (!current.path.includes(callee)) {
                        queue.push({
                            id: callee,
                            depth: current.depth + 1,
                            path: [...current.path, callee],
                        });
                        added = true;
                    }
                }

                // If all branches were cycles, save current path
                if (!added && current.path.length >= this.config.minSteps) {
                    this.traces.push([...current.path]);
                    tracesFound++;
                }
            }
        }
    }
}

// BFS walker for graph traversal
export class BFSWalker {
    private graph: Map<string, string[]>;
    private visited: Set<string> = new Set();

    constructor(graph: Map<string, string[]>) {
        this.graph = graph;
    }

    // Find all nodes within N hops
    findWithinHops(startId: string, maxHops: number): string[] {
        const result: string[] = [];
        const queue: { id: string; hops: number }[] = [{ id: startId, hops: 0 }];
        this.visited.clear();
        this.visited.add(startId);

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (current.hops > 0) {
                result.push(current.id);
            }

            if (current.hops < maxHops) {
                const neighbors = this.graph.get(current.id) || [];
                for (const neighbor of neighbors) {
                    if (!this.visited.has(neighbor)) {
                        this.visited.add(neighbor);
                        queue.push({ id: neighbor, hops: current.hops + 1 });
                    }
                }
            }
        }

        return result;
    }

    // Find all paths between nodes (limited depth)
    findAllPaths(startId: string, endId: string, maxDepth: number): string[][] {
        const paths: string[][] = [];
        const dfs = (currentId: string, path: string[], depth: number) => {
            if (depth > maxDepth) return;
            if (currentId === endId && path.length > 0) {
                paths.push([...path]);
                return;
            }

            const neighbors = this.graph.get(currentId) || [];
            for (const neighbor of neighbors) {
                if (!path.includes(neighbor)) {
                    dfs(neighbor, [...path, neighbor], depth + 1);
                }
            }
        };

        dfs(startId, [startId], 0);
        return paths;
    }
}

// Build trace from entry point (convenience function)
export function buildTrace(
    entryId: string,
    callGraph: Map<string, string[]>,
    nodeMap: Map<string, GraphNode>,
    config?: Partial<ProcessConfig>
): string[][] {
    const builder = new TraceBuilder(callGraph, nodeMap, config);
    return builder.buildTraces(entryId);
}

// Deduplicate traces (remove subsets)
export function deduplicateTraces(traces: string[][]): string[][] {
    if (traces.length === 0) return [];

    // Sort by length descending
    const sorted = [...traces].sort((a, b) => b.length - a.length);
    const unique: string[][] = [];

    for (const trace of sorted) {
        const traceKey = trace.join('->');
        const isSubset = unique.some(existing => {
            const existingKey = existing.join('->');
            return existingKey.includes(traceKey);
        });

        if (!isSubset) {
            unique.push(trace);
        }
    }

    return unique;
}

// Deduplicate by entry/terminal endpoints (keep longest per pair)
export function deduplicateByEndpoints(traces: string[][]): string[][] {
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