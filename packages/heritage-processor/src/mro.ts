import type { InheritanceGraph } from './inheritance-graph.js';
import type { MROResult, MethodConflict } from './types.js';

// Compute Method Resolution Order for a class
export function computeMRO(
    classId: string,
    graph: InheritanceGraph,
    methodConflicts?: Map<string, string[]>
): MROResult {
    const node = graph.getNode(classId);
    if (!node) {
        return {
            classId,
            linearization: [],
            conflicts: [],
        };
    }

    // Use C3 linearization for Python-like MRO
    const linearization = c3Linearization(classId, graph);

    // Detect method conflicts
    const conflicts = detectMethodConflicts(classId, linearization, graph, methodConflicts);

    return {
        classId,
        linearization,
        conflicts,
    };
}

// C3 linearization algorithm (used by Python)
function c3Linearization(classId: string, graph: InheritanceGraph): string[] {
    const node = graph.getNode(classId);
    if (!node) return [classId];

    // Base case: no parents
    if (node.parents.length === 0) {
        return [classId];
    }

    // Get linearizations of all parents
    const parentLinearizations: string[][] = [];
    for (const parentId of node.parents) {
        parentLinearizations.push(c3Linearization(parentId, graph));
    }

    // Add parents list as last sequence
    const sequences = [...parentLinearizations, [...node.parents]];
    const result: string[] = [classId];

    while (sequences.some(s => s.length > 0)) {
        // Find a good head
        let candidate: string | null = null;
        for (const seq of sequences) {
            if (seq.length === 0) continue;
            const head = seq[0];
            // Check if head is not in the tail of any other sequence
            const inTail = sequences.some(other =>
                other.length > 1 && other.slice(1).includes(head)
            );
            if (!inTail) {
                candidate = head;
                break;
            }
        }

        if (candidate === null) {
            // Inconsistent hierarchy - fallback to DFS
            return dfsLinearization(classId, graph);
        }

        result.push(candidate);

        // Remove candidate from all sequences
        for (const seq of sequences) {
            if (seq.length > 0 && seq[0] === candidate) {
                seq.shift();
            }
        }
    }

    return result;
}

// DFS linearization (fallback for inconsistent hierarchies)
function dfsLinearization(classId: string, graph: InheritanceGraph): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    function dfs(currentId: string): void {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        const node = graph.getNode(currentId);
        if (node) {
            for (const parentId of node.parents) {
                dfs(parentId);
            }
        }

        result.push(currentId);
    }

    dfs(classId);
    return result;
}

// Detect method conflicts in inheritance hierarchy
function detectMethodConflicts(
    classId: string,
    linearization: string[],
    graph: InheritanceGraph,
    methodConflicts?: Map<string, string[]>
): MethodConflict[] {
    const conflicts: MethodConflict[] = [];

    if (!methodConflicts) return conflicts;

    for (const [methodName, sources] of methodConflicts) {
        if (sources.length < 2) continue;

        // Find first definition in MRO order
        let resolvedTo: string | null = null;
        for (const ancestorId of linearization) {
            if (sources.includes(ancestorId)) {
                resolvedTo = ancestorId;
                break;
            }
        }

        conflicts.push({
            methodName,
            sources,
            resolvedTo,
            reason: resolvedTo
                ? `Resolved to ${resolvedTo} by MRO`
                : 'Ambiguous - no unique resolution',
        });
    }

    return conflicts;
}

// Compute MRO for all classes in graph
export function computeAllMRO(
    graph: InheritanceGraph,
    methodConflicts?: Map<string, string[]>
): Map<string, MROResult> {
    const results = new Map<string, MROResult>();

    for (const node of graph.getAllNodes()) {
        if (node.kind === 'class') {
            results.set(node.id, computeMRO(node.id, graph, methodConflicts));
        }
    }

    return results;
}