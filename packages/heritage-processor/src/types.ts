import type { GraphNode, LanguageId } from '@codeagent/core-types';

// Heritage relationship edge
export interface HeritageEdge {
    sourceId: string;
    targetId: string;
    kind: 'extends' | 'implements' | 'mixin' | 'embedding';
    confidence: number;
    sourceFile: string;
    targetFile: string;
}

// Heritage processing result
export interface HeritageResult {
    edges: HeritageEdge[];
    stats: {
        total: number;
        extends: number;
        implements: number;
        mixin: number;
        embedding: number;
    };
}

// Heritage extraction context
export interface HeritageContext {
    currentFile: string;
    language: LanguageId;
    symbols: Map<string, GraphNode>;
    imports: Map<string, Set<string>>;
    fileIndex: Map<string, string>;
}

// Node in inheritance graph
export interface InheritanceNode {
    id: string;
    name: string;
    filePath: string;
    kind: 'class' | 'interface' | 'struct' | 'trait';
    parents: string[];
    children: string[];
    interfaces: string[];
}

// MRO result
export interface MROResult {
    classId: string;
    linearization: string[];
    conflicts: MethodConflict[];
}

// Method conflict in inheritance hierarchy
export interface MethodConflict {
    methodName: string;
    sources: string[];
    resolvedTo: string | null;
    reason: string;
}