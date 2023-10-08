import type Parser from 'tree-sitter';
import { createParser } from '@codeagent/tree-sitter-wrapper';
import { detectLanguage } from '@codeagent/language-detector';
import { generateId } from './id-generator.js';
import { isExported } from './export-detector.js';
import { getNodeLocation } from './position.js';
import { findDefinitions, findCalls, findImports } from './matcher.js';
import type { ExtractedSymbol, ExtractionResult, ExtractionOptions, CaptureMap } from './types.js';

// Default extraction options
const DEFAULT_OPTIONS: ExtractionOptions = {
    includeComments: false,
    includeBody: false,
    maxDepth: Infinity,
    extractRelationships: true,
};

// Symbol kind mapping from node types
const kindMapping: Record<string, string> = {
    function_declaration: 'Function',
    function_definition: 'Function',
    method_definition: 'Method',
    class_declaration: 'Class',
    interface_declaration: 'Interface',
    struct_declaration: 'Struct',
    enum_declaration: 'Enum',
    variable_declaration: 'Variable',
    property_declaration: 'Property',
    constructor_declaration: 'Constructor',
};

export class SymbolExtractor {
    private options: ExtractionOptions;

    constructor(options: ExtractionOptions = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    async extractFromContent(
        filePath: string,
        content: string
    ): Promise<ExtractionResult> {
        const result: ExtractionResult = {
            symbols: [],
            relationships: [],
            errors: [],
        };

        try {
            const language = detectLanguage(filePath, content).language;
            const { tree } = await createParser(language, content, {}, filePath);

            // Extract definitions
            const definitions = await findDefinitions(tree, language);
            for (const def of definitions) {
                const symbol = this.extractSymbol(def, filePath, language, content);
                if (symbol) {
                    result.symbols.push(symbol);
                }
            }

            // Extract relationships (calls, imports) if requested
            if (this.options.extractRelationships) {
                const calls = await findCalls(tree, language);
                const imports = await findImports(tree, language);

                for (const call of calls) {
                    const rel = this.extractCallRelationship(call, filePath, result.symbols);
                    if (rel) {
                        result.relationships.push(rel);
                    }
                }

                for (const imp of imports) {
                    const rel = this.extractImportRelationship(imp, filePath);
                    if (rel) {
                        result.relationships.push(rel);
                    }
                }
            }
        } catch (error) {
            result.errors.push({
                filePath,
                message: error instanceof Error ? error.message : String(error),
            });
        }

        return result;
    }

    private extractSymbol(
        captureMap: CaptureMap,
        filePath: string,
        language: string,
        content: string
    ): ExtractedSymbol | null {
        const nameNode = captureMap.name;
        if (!nameNode) return null;

        const nodeType = this.findDefinitionNodeType(captureMap);
        const kind = kindMapping[nodeType] || 'CodeElement';
        const name = nameNode.text;
        const location = getNodeLocation(nameNode);
        const exported = isExported(nameNode, name, language as any);

        const id = generateId(kind, `${filePath}:${name}`);

        return {
            id,
            kind: kind as any,
            name,
            filePath,
            startLine: location.startLine,
            endLine: location.endLine,
            startColumn: location.startColumn,
            endColumn: location.endColumn,
            language: language as any,
            isExported: exported,
            metadata: this.extractMetadata(captureMap, content),
        };
    }

    private findDefinitionNodeType(captureMap: CaptureMap): string {
        const definitionKeys = ['definition', 'definition.function', 'definition.class', 'definition.method'];
        for (const key of definitionKeys) {
            if (captureMap[key]) {
                return captureMap[key].type;
            }
        }
        return 'unknown';
    }

    private extractMetadata(captureMap: CaptureMap, content: string): any {
        const metadata: any = {};

        // Extract doc comment if available
        const commentNode = captureMap.comment;
        if (commentNode) {
            metadata.docComment = commentNode.text;
        }

        // Extract return type for functions
        const returnTypeNode = captureMap.return_type;
        if (returnTypeNode) {
            metadata.returnType = returnTypeNode.text;
        }

        // Extract parameters for functions/methods
        const paramsNode = captureMap.parameters;
        if (paramsNode) {
            metadata.parameters = this.extractParameters(paramsNode);
        }

        return metadata;
    }

    private extractParameters(paramsNode: Parser.SyntaxNode): any[] {
        const parameters: any[] = [];
        for (const child of paramsNode.children) {
            if (child.type === 'parameter' || child.type === 'formal_parameter') {
                const nameNode = child.childForFieldName('name');
                const typeNode = child.childForFieldName('type');
                parameters.push({
                    name: nameNode?.text || 'unknown',
                    type: typeNode?.text,
                    isOptional: child.text?.includes('?') || false,
                    isRest: child.text?.includes('...') || false,
                });
            }
        }
        return parameters;
    }

    private extractCallRelationship(
        captureMap: CaptureMap,
        filePath: string,
        symbols: ExtractedSymbol[]
    ): { sourceId: string; targetId: string; kind: string } | null {
        const callNameNode = captureMap['call.name'];
        if (!callNameNode) return null;

        const callName = callNameNode.text;
        const location = getNodeLocation(callNameNode);

        // Find matching symbol in the same file
        const targetSymbol = symbols.find(s =>
            s.name === callName && s.filePath === filePath && s.startLine <= location.startLine
        );

        if (!targetSymbol) return null;

        // Find enclosing function as source
        const enclosing = this.findEnclosingFunction(callNameNode, symbols, filePath);
        if (!enclosing) return null;

        return {
            sourceId: enclosing.id,
            targetId: targetSymbol.id,
            kind: 'CALLS',
        };
    }

    private findEnclosingFunction(
        node: Parser.SyntaxNode,
        symbols: ExtractedSymbol[],
        filePath: string
    ): ExtractedSymbol | null {
        let current = node.parent;
        while (current) {
            const matching = symbols.find(s =>
                s.filePath === filePath &&
                s.startLine <= current.startPosition.row + 1 &&
                s.endLine >= current.endPosition.row + 1 &&
                (s.kind === 'Function' || s.kind === 'Method')
            );
            if (matching) return matching;
            current = current.parent;
        }
        return null;
    }

    private extractImportRelationship(
        captureMap: CaptureMap,
        filePath: string
    ): { sourceId: string; targetId: string; kind: string } | null {
        const sourceNode = captureMap['import.source'];
        if (!sourceNode) return null;

        // Extract import path (strip quotes)
        let importPath = sourceNode.text;
        importPath = importPath.replace(/['"<>]/g, '');

        // Generate IDs for file-level import relationship
        const sourceId = generateId('File', filePath);
        const targetId = generateId('File', importPath);

        return {
            sourceId,
            targetId,
            kind: 'IMPORTS',
        };
    }
}

// Convenience function
export async function extractSymbols(
    filePath: string,
    content: string,
    options?: ExtractionOptions
): Promise<ExtractionResult> {
    const extractor = new SymbolExtractor(options);
    return extractor.extractFromContent(filePath, content);
}

// Extract from file path
export async function extractFromFile(
    filePath: string,
    content: string,
    options?: ExtractionOptions
): Promise<ExtractionResult> {
    return extractSymbols(filePath, content, options);
}