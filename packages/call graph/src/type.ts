import type { GraphNode, LanguageId } from '@codeagent/core-types';

// Call site information
export interface CallSite {
    /** Source file path */
    filePath: string;
    /** Name of the called function/method */
    calledName: string;
    /** ID of the calling symbol (source) */
    sourceId: string;
    /** Line number of the call */
    line: number;
    /** Column number of the call */
    column: number;
    /** Number of arguments passed */
    argumentCount: number;
    /** Type of call (free, member, constructor) */
    callForm: CallForm;
    /** Receiver expression for member calls (e.g., "user" in user.save()) */
    receiver?: string;
    /** Resolved type of receiver (if known) */
    receiverType?: string;
    /** Whether the call is in a chain (e.g., a.b().c()) */
    isChained?: boolean;
    /** Chain depth for nested calls */
    chainDepth?: number;
}

// Call form types
export type CallForm = 'free' | 'member' | 'constructor' | 'static';

// Call edge result
export interface CallEdge {
    sourceId: string;
    targetId: string;
    confidence: number;
    reason: string;
    callSite: CallSite;
}

// Call graph building result
export interface CallGraphResult {
    edges: CallEdge[];
    unresolvedCalls: UnresolvedCall[];
    stats: {
        totalCalls: number;
        resolved: number;
        unresolved: number;
        averageConfidence: number;
    };
}

// Unresolved call (could not find target)
export interface UnresolvedCall {
    callSite: CallSite;
    reason: string;
    possibleTargets?: string[];
}

// Call resolution context
export interface CallContext {
    currentFile: string;
    language: LanguageId;
    symbols: Map<string, GraphNode>;
    imports: Map<string, Set<string>>;
    typeEnv: Map<string, string>;
}

// Confidence level
export interface ConfidenceLevel {
    level: 'high' | 'medium' | 'low';
    score: number;
    reason: string;
}