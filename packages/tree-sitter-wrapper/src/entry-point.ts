import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import type { EntryPointScore } from './types.js';

// Score multipliers
const EXPORT_MULTIPLIER = 2.0;
const NAME_PATTERN_MULTIPLIER = 1.5;
const UTILITY_PENALTY = 0.3;

// Entry point name patterns (functions likely to be entry points)
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
    /^use[A-Z]/, // React hooks
    /^app$/, // Flask/FastAPI
    /^view_/, // Django
    /^do[A-Z]/, // Servlets
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

// Check if a file is a test file
export function isTestFile(filePath: string): boolean {
    return TEST_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}

// Score an entry point candidate
export function scoreEntryPoint(
    node: GraphNode,
    callers: GraphEdge[],
    callees: GraphEdge[]
): EntryPointScore {
    const reasons: string[] = [];

    // Must have outgoing calls to trace
    if (callees.length === 0) {
        return { nodeId: node.id, score: 0, reasons: ['no-outgoing-calls'] };
    }

    // Base score: call ratio (calls many, called by few)
    const baseScore = callees.length / (callers.length + 1);
    reasons.push(`base:${baseScore.toFixed(2)}`);

    // Export bonus
    let score = baseScore;
    if (node.isExported) {
        score *= EXPORT_MULTIPLIER;
        reasons.push('exported');
    }

    // Name pattern scoring
    const name = node.name;
    let nameMultiplier = 1.0;

    // Check utility patterns first (penalize)
    if (UTILITY_PATTERNS.some(p => p.test(name))) {
        nameMultiplier = UTILITY_PENALTY;
        reasons.push('utility-pattern');
    }
    // Check entry patterns (bonus)
    else if (ENTRY_PATTERNS.some(p => p.test(name))) {
        nameMultiplier = NAME_PATTERN_MULTIPLIER;
        reasons.push('entry-pattern');
    }

    score *= nameMultiplier;

    // Framework detection bonus (based on file path)
    const frameworkBonus = detectFrameworkFromPath(node.filePath);
    if (frameworkBonus > 1) {
        score *= frameworkBonus;
        reasons.push('framework');
    }

    return { nodeId: node.id, score, reasons };
}

// Detect framework from file path
function detectFrameworkFromPath(filePath: string): number {
    const path = filePath.toLowerCase();

    // Next.js pages
    if (path.includes('/pages/') && !path.includes('/api/')) {
        return 3.0;
    }

    // Next.js app router
    if (path.includes('/app/') && path.includes('page.tsx')) {
        return 3.0;
    }

    // Express routes
    if (path.includes('/routes/')) {
        return 2.5;
    }

    // Controllers
    if (path.includes('/controllers/')) {
        return 2.5;
    }

    // Django views
    if (path.endsWith('views.py')) {
        return 3.0;
    }

    // Spring controllers
    if (path.endsWith('controller.java')) {
        return 3.0;
    }

    // Main entry files
    if (path.endsWith('/main.go') || path.endsWith('/main.rs') || path.endsWith('/main.py')) {
        return 3.0;
    }

    return 1.0;
}

// Find entry points in the graph
export function findEntryPoints(
    graph: Map<string, GraphNode>,
    edges: Map<string, GraphEdge[]>,
    reverseEdges: Map<string, GraphEdge[]>
): EntryPointScore[] {
    const candidates: EntryPointScore[] = [];

    for (const [id, node] of graph) {
        // Only consider functions and methods
        if (node.kind !== 'Function' && node.kind !== 'Method') continue;

        // Skip test files
        if (isTestFile(node.filePath)) continue;

        const callers = reverseEdges.get(id) || [];
        const callees = edges.get(id) || [];

        const score = scoreEntryPoint(node, callers, callees);
        if (score.score > 0) {
            candidates.push(score);
        }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Limit to top candidates
    return candidates.slice(0, 200);
}