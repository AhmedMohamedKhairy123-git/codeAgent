import type { GraphNode } from '@codeagent/core-types';
import type { Process } from './types.js';

// Generate heuristic label for a process
export function generateProcessLabel(
    trace: string[],
    nodeMap: Map<string, GraphNode>
): string {
    if (trace.length === 0) return 'Empty Process';

    const entryNode = nodeMap.get(trace[0]);
    const terminalNode = nodeMap.get(trace[trace.length - 1]);

    const entryName = entryNode?.name || 'Unknown';
    const terminalName = terminalNode?.name || 'Unknown';

    return `${capitalize(entryName)} → ${capitalize(terminalName)}`;
}

// Sanitize ID for process
export function sanitizeProcessId(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30)
        .toLowerCase();
}

// Generate process type based on communities
export function determineProcessType(
    communities: string[],
    membershipMap: Map<string, string>
): 'intra_community' | 'cross_community' {
    if (communities.length > 1) {
        return 'cross_community';
    }
    return 'intra_community';
}

// Collect communities touched by a trace
export function collectTraceCommunities(
    trace: string[],
    membershipMap: Map<string, string>
): string[] {
    const communities = new Set<string>();

    for (const nodeId of trace) {
        const communityId = membershipMap.get(nodeId);
        if (communityId) {
            communities.add(communityId);
        }
    }

    return Array.from(communities);
}

// Capitalize first letter
function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Generate detailed process label with type
export function generateDetailedLabel(
    process: Process,
    nodeMap: Map<string, GraphNode>
): string {
    const entryNode = nodeMap.get(process.entryPointId);
    const terminalNode = nodeMap.get(process.terminalId);

    const entryName = entryNode?.name || '?';
    const terminalName = terminalNode?.name || '?';
    const typeSymbol = process.processType === 'cross_community' ? '🌐' : '📦';

    return `${typeSymbol} ${entryName} → ${terminalName} (${process.stepCount} steps)`;
}