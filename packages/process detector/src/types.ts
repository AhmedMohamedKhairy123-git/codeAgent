import type { GraphNode, GraphEdge } from '@codeagent/core-types';

// Process node
export interface Process {
    id: string;
    label: string;
    heuristicLabel: string;
    processType: 'intra_community' | 'cross_community';
    stepCount: number;
    communities: string[];
    entryPointId: string;
    terminalId: string;
    trace: string[];
}

// Process step (edge between node and process)
export interface ProcessStep {
    nodeId: string;
    processId: string;
    step: number;
}

// Process detection result
export interface ProcessResult {
    processes: Process[];
    steps: ProcessStep[];
    stats: {
        totalProcesses: number;
        crossCommunityCount: number;
        avgStepCount: number;
        entryPointsFound: number;
    };
}

// Trace node for BFS traversal
export interface TraceNode {
    id: string;
    depth: number;
    path: string[];
}

// Process detection configuration
export interface ProcessConfig {
    maxTraceDepth: number;
    maxBranching: number;
    maxProcesses: number;
    minSteps: number;
    minConfidence: number;
}

// Entry point score result
export interface EntryPointScore {
    nodeId: string;
    score: number;
    reasons: string[];
}