import type { GraphNode, GraphEdge, GraphStore } from '@codeagent/core-types';
import { createGraphStore } from '@codeagent/graph-store';
import type { CallSite, CallGraphResult, CallEdge, CallContext, UnresolvedCall } from './types.js';
import { calculateConfidence, shouldIncludeCall } from './confidence.js';
import { resolveReceiverType } from './receiver.js';

// Call graph builder configuration
export interface BuilderConfig {
    minConfidence?: number;
    includeUnresolved?: boolean;
    maxChainDepth?: number;
}

const DEFAULT_CONFIG: BuilderConfig = {
    minConfidence: 0,
    includeUnresolved: true,
    maxChainDepth: 5,
};

export class CallGraphBuilder {
    private graph: GraphStore;
    private config: BuilderConfig;
    private edges: CallEdge[] = [];
    private unresolved: UnresolvedCall[] = [];

    constructor(config: BuilderConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.graph = createGraphStore();
    }

    // Add a symbol to the graph
    addSymbol(node: GraphNode): void {
        this.graph = this.graph.addNode(node);
    }

    // Add multiple symbols
    addSymbols(nodes: GraphNode[]): void {
        for (const node of nodes) {
            this.graph = this.graph.addNode(node);
        }
    }

    // Process a call site
    async processCall(
        callSite: CallSite,
        context: CallContext
    ): Promise<CallEdge | null> {
        // Find potential targets
        const targets = await this.findTargets(callSite, context);
        const hasMultiple = targets.length > 1;

        // Try to resolve receiver type for member calls
        if (callSite.callForm === 'member' && callSite.receiver) {
            const receiverType = await resolveReceiverType(callSite, context);
            if (receiverType) {
                // Filter targets by receiver type
                const filtered = targets.filter(t => this.matchesReceiver(t, receiverType));
                if (filtered.length === 1) {
                    const confidence = calculateConfidence(
                        callSite,
                        filtered[0].kind,
                        'receiver-resolved',
                        false
                    );
                    if (shouldIncludeCall(confidence, this.config.minConfidence)) {
                        return this.createEdge(callSite, filtered[0], confidence);
                    }
                }
            }
        }

        // If exactly one target, use it
        if (targets.length === 1) {
            const confidence = calculateConfidence(
                callSite,
                targets[0].kind,
                'exact-match',
                false
            );
            if (shouldIncludeCall(confidence, this.config.minConfidence)) {
                return this.createEdge(callSite, targets[0], confidence);
            }
        }

        // If multiple targets, record as unresolved
        if (this.config.includeUnresolved) {
            this.unresolved.push({
                callSite,
                reason: hasMultiple ? 'multiple candidates' : 'no candidates',
                possibleTargets: targets.map(t => t.name),
            });
        }

        return null;
    }

    // Process multiple call sites
    async processCalls(
        callSites: CallSite[],
        context: CallContext
    ): Promise<CallGraphResult> {
        let resolved = 0;

        for (const callSite of callSites) {
            const edge = await this.processCall(callSite, context);
            if (edge) {
                this.edges.push(edge);
                this.graph = this.graph.addEdge(edge);
                resolved++;
            }
        }

        const avgConfidence = this.edges.length > 0
            ? this.edges.reduce((sum, e) => sum + e.confidence, 0) / this.edges.length
            : 0;

        return {
            edges: this.edges,
            unresolvedCalls: this.unresolved,
            stats: {
                totalCalls: callSites.length,
                resolved,
                unresolved: callSites.length - resolved,
                averageConfidence: avgConfidence,
            },
        };
    }

    // Get the underlying graph
    getGraph(): GraphStore {
        return this.graph;
    }

    // Find potential targets for a call
    private async findTargets(
        callSite: CallSite,
        context: CallContext
    ): Promise<GraphNode[]> {
        const targets: GraphNode[] = [];

        // Search in current file first
        for (const [id, node] of context.symbols) {
            if (node.name === callSite.calledName && node.filePath === callSite.filePath) {
                if (this.isCallable(node)) {
                    targets.push(node);
                }
            }
        }

        // Search in imported files
        const imports = context.imports.get(callSite.filePath);
        if (imports) {
            for (const importedFile of imports) {
                for (const [id, node] of context.symbols) {
                    if (node.name === callSite.calledName && node.filePath === importedFile) {
                        if (this.isCallable(node)) {
                            targets.push(node);
                        }
                    }
                }
            }
        }

        // Global search (lower confidence)
        for (const [id, node] of context.symbols) {
            if (node.name === callSite.calledName && !targets.includes(node)) {
                if (this.isCallable(node)) {
                    targets.push(node);
                }
            }
        }

        return targets;
    }

    // Check if a node is callable
    private isCallable(node: GraphNode): boolean {
        const callableKinds = ['Function', 'Method', 'Constructor'];
        return callableKinds.includes(node.kind);
    }

    // Check if a target matches the receiver type
    private matchesReceiver(target: GraphNode, receiverType: string): boolean {
        // Check if target belongs to a class with the receiver type
        // This would need class-method relationships
        // Simplified: check if target's ID contains the receiver type
        return target.id.includes(receiverType) || target.name === receiverType;
    }

    // Create a call edge
    private createEdge(
        callSite: CallSite,
        target: GraphNode,
        confidence: ConfidenceLevel
    ): CallEdge {
        return {
            sourceId: callSite.sourceId,
            targetId: target.id,
            confidence: confidence.score,
            reason: confidence.reason,
            callSite,
        };
    }
}

// Convenience function
export async function buildCallGraph(
    callSites: CallSite[],
    symbols: GraphNode[],
    imports: Map<string, Set<string>>,
    typeEnv: Map<string, string>,
    currentFile: string,
    language: string,
    config?: BuilderConfig
): Promise<CallGraphResult> {
    const builder = new CallGraphBuilder(config);

    for (const symbol of symbols) {
        builder.addSymbol(symbol);
    }

    const context: CallContext = {
        currentFile,
        language: language as any,
        symbols: new Map(symbols.map(s => [s.id, s])),
        imports,
        typeEnv,
    };

    return builder.processCalls(callSites, context);
}