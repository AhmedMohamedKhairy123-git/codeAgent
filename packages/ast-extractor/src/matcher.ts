import type Parser from 'tree-sitter';
import type { LanguageId } from '@codeagent/core-types';
import { getQuery } from '@codeagent/tree-sitter-wrapper';
import type { CaptureMap } from './types.js';

// Pattern matching result
export interface MatchResult {
    pattern: number;
    captures: CaptureMap;
}

// Match a pattern against a node
export async function matchPattern(
    node: Parser.SyntaxNode,
    pattern: string,
    languageId: LanguageId
): Promise<MatchResult[]> {
    const query = await getQuery(languageId, pattern);
    const matches = query.matches(node);
    return matches.map(match => ({
        pattern: match.pattern,
        captures: match.captures.reduce((acc, cap) => {
            acc[cap.name] = cap.node;
            return acc;
        }, {} as CaptureMap),
    }));
}

// Find all definitions in a tree
export async function findDefinitions(
    tree: Parser.Tree,
    languageId: LanguageId
): Promise<CaptureMap[]> {
    const results: CaptureMap[] = [];

    const definitionPatterns = [
        'function_declaration',
        'class_declaration',
        'method_definition',
        'interface_declaration',
    ];

    for (const pattern of definitionPatterns) {
        const query = await getQuery(languageId, `(${pattern} name: (_) @name) @definition`);
        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            const captures: CaptureMap = {};
            for (const cap of match.captures) {
                captures[cap.name] = cap.node;
            }
            if (captures.name) {
                results.push(captures);
            }
        }
    }

    return results;
}

// Find all call sites in a tree
export async function findCalls(
    tree: Parser.Tree,
    languageId: LanguageId
): Promise<CaptureMap[]> {
    const results: CaptureMap[] = [];

    const callPatterns = [
        '(call_expression function: (_) @call.name) @call',
        '(method_invocation name: (_) @call.name) @call',
        '(function_call_expression function: (_) @call.name) @call',
    ];

    for (const pattern of callPatterns) {
        const query = await getQuery(languageId, pattern);
        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            const captures: CaptureMap = {};
            for (const cap of match.captures) {
                captures[cap.name] = cap.node;
            }
            if (captures['call.name']) {
                results.push(captures);
            }
        }
    }

    return results;
}

// Find all imports in a tree
export async function findImports(
    tree: Parser.Tree,
    languageId: LanguageId
): Promise<CaptureMap[]> {
    const results: CaptureMap[] = [];

    const importPatterns = [
        '(import_statement source: (string) @import.source) @import',
        '(import_declaration (_) @import.source) @import',
        '(namespace_use_declaration (namespace_use_clause (qualified_name) @import.source)) @import',
    ];

    for (const pattern of importPatterns) {
        const query = await getQuery(languageId, pattern);
        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            const captures: CaptureMap = {};
            for (const cap of match.captures) {
                captures[cap.name] = cap.node;
            }
            if (captures['import.source']) {
                results.push(captures);
            }
        }
    }

    return results;
}