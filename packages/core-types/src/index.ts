// Core type definitions for CodeAgent

// Language support
export type LanguageId =
    | 'javascript' | 'typescript' | 'python' | 'java' | 'go'
    | 'rust' | 'cpp' | 'csharp' | 'php' | 'ruby' | 'swift' | 'kotlin';

// Node types in the knowledge graph
export type NodeKind =
    | 'File' | 'Folder' | 'Function' | 'Class' | 'Method'
    | 'Interface' | 'Property' | 'Variable' | 'Enum' | 'TypeAlias'
    | 'Constructor' | 'Module' | 'Namespace' | 'Import'
    | 'Community' | 'Process' | 'CodeElement';

// Relationship types
export type RelationKind =
    | 'CONTAINS' | 'DEFINES' | 'IMPORTS' | 'CALLS'
    | 'EXTENDS' | 'IMPLEMENTS' | 'HAS_METHOD' | 'HAS_PROPERTY'
    | 'ACCESSES' | 'OVERRIDES' | 'MEMBER_OF' | 'STEP_IN_PROCESS';

// Base graph node
export interface GraphNode {
    id: string;
    kind: NodeKind;
    name: string;
    filePath: string;
    startLine?: number;
    endLine?: number;
    language?: LanguageId;
    isExported?: boolean;
    metadata?: Record<string, unknown>;
}

// Graph relationship
export interface GraphEdge {
    id: string;
    sourceId: string;
    targetId: string;
    kind: RelationKind;
    confidence: number;
    reason?: string;
    step?: number;
}

// Complete knowledge graph
export interface KnowledgeGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    nodeCount: number;
    edgeCount: number;
}

// Symbol definition for resolution
export interface SymbolDefinition {
    nodeId: string;
    name: string;
    kind: NodeKind;
    filePath: string;
    parameterCount?: number;
    returnType?: string;
    declaredType?: string;
    ownerId?: string;
}

// Source file representation
export interface SourceFile {
    path: string;
    content: string;
    language: LanguageId;
}

// Progress tracking
export interface PipelineProgress {
    phase: string;
    percent: number;
    message: string;
    detail?: string;
    processed?: number;
    total?: number;
}
// Type guards
export function isFileNode(node: GraphNode): node is GraphNode & { kind: 'File' } {
    return node.kind === 'File';
}

export function isFunctionNode(node: GraphNode): node is GraphNode & { kind: 'Function' } {
    return node.kind === 'Function';
}

export function isClassNode(node: GraphNode): node is GraphNode & { kind: 'Class' } {
    return node.kind === 'Class';
}

// Result type for operations that can fail
export type Result<T, E = Error> =
    | { success: true; value: T }
    | { success: false; error: E };

// Helper to create results
export function ok<T>(value: T): Result<T, never> {
    return { success: true, value };
}

export function err<E>(error: E): Result<never, E> {
    return { success: false, error };
}