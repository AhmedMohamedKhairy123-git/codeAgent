import type { NodeKind, LanguageId, GraphNode } from '@codeagent/core-types';
import type Parser from 'tree-sitter';

// Extracted symbol from AST
export interface ExtractedSymbol {
    id: string;
    kind: NodeKind;
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    language: LanguageId;
    isExported: boolean;
    parentId?: string;
    metadata?: SymbolMetadata;
}

// Additional symbol metadata
export interface SymbolMetadata {
    parameters?: ParameterInfo[];
    returnType?: string;
    typeParameters?: string[];
    modifiers?: string[];
    docComment?: string;
    isStatic?: boolean;
    isAbstract?: boolean;
    isAsync?: boolean;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
}

// Parameter information
export interface ParameterInfo {
    name: string;
    type?: string;
    isOptional: boolean;
    isRest: boolean;
    defaultValue?: string;
}

// Extraction result
export interface ExtractionResult {
    symbols: ExtractedSymbol[];
    relationships: Array<{
        sourceId: string;
        targetId: string;
        kind: string;
    }>;
    errors: ExtractionError[];
}

// Extraction error
export interface ExtractionError {
    filePath: string;
    message: string;
    line?: number;
}

// Extraction options
export interface ExtractionOptions {
    includeComments?: boolean;
    includeBody?: boolean;
    maxDepth?: number;
    extractRelationships?: boolean;
}

// Capture map from tree-sitter query
export interface CaptureMap {
    [key: string]: Parser.SyntaxNode;
}