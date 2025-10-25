import type { LanguageId } from '@codeagent/core-types';
import type Parser from 'tree-sitter';

// Parser handle with language info
export interface ParserHandle {
    parser: Parser;
    languageId: LanguageId;
    lastUsed: number;
}

// Parse options
export interface ParseOptions {
    /** Buffer size for parsing (bytes). Default: 512KB */
    bufferSize?: number;
    /** Whether to include ranges in results */
    includeRanges?: boolean;
    /** Timeout in milliseconds (0 = no timeout) */
    timeout?: number;
}

// Query match result
export interface QueryMatch {
    /** Pattern index that matched */
    pattern: number;
    /** Captures in this match */
    captures: Capture[];
}

// Capture result
export interface Capture {
    /** Capture name (e.g., "definition.function") */
    name: string;
    /** Captured node */
    node: Parser.SyntaxNode;
}

// Node information for serialization
export interface NodeInfo {
    id: number;
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    startIndex: number;
    endIndex: number;
    isNamed: boolean;
    hasError: boolean;
    children: NodeInfo[];
}

// Language grammar info
export interface LanguageGrammar {
    id: LanguageId;
    module: any;
    queries: Map<string, string>;
    wasmPath?: string;
    usesTypescriptGrammar?: boolean;
    tsxSupport?: boolean;
}
import type { GraphNode, GraphEdge } from '@codeagent/core-types';

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

export interface ProcessStep {
    nodeId: string;
    processId: string;
    step: number;
}

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

export interface TraceNode {
    id: string;
    depth: number;
    path: string[];
}

export interface ProcessConfig {
    maxTraceDepth: number;
    maxBranching: number;
    maxProcesses: number;
    minSteps: number;
    minConfidence: number;
}

export interface EntryPointScore {
    nodeId: string;
    score: number;
    reasons: string[];
}