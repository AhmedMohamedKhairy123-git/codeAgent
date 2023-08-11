import type Parser from 'tree-sitter';
import type { LanguageId } from '@codeagent/core-types';
import { loadLanguage } from './language-loader.js';

// Cache compiled queries
const queryCache = new Map<string, Parser.Query>();

// Query definitions for different languages
export const QUERY_DEFINITIONS: Record<LanguageId, string> = {
    javascript: `
    (function_declaration name: (identifier) @name) @definition.function
    (class_declaration name: (identifier) @name) @definition.class
    (method_definition name: (property_identifier) @name) @definition.method
    (call_expression function: (identifier) @call.name) @call
    (import_statement source: (string) @import.source) @import
  `,
    typescript: `
    (function_declaration name: (identifier) @name) @definition.function
    (class_declaration name: (type_identifier) @name) @definition.class
    (interface_declaration name: (type_identifier) @name) @definition.interface
    (method_definition name: (property_identifier) @name) @definition.method
    (call_expression function: (identifier) @call.name) @call
    (import_statement source: (string) @import.source) @import
  `,
    python: `
    (function_definition name: (identifier) @name) @definition.function
    (class_definition name: (identifier) @name) @definition.class
    (call function: (identifier) @call.name) @call
    (import_statement name: (dotted_name) @import.source) @import
    (import_from_statement module_name: (dotted_name) @import.source) @import
  `,
    java: `
    (method_declaration name: (identifier) @name) @definition.method
    (class_declaration name: (identifier) @name) @definition.class
    (interface_declaration name: (identifier) @name) @definition.interface
    (method_invocation name: (identifier) @call.name) @call
    (import_declaration (_) @import.source) @import
  `,
    go: `
    (function_declaration name: (identifier) @name) @definition.function
    (method_declaration name: (field_identifier) @name) @definition.method
    (type_declaration (type_spec name: (type_identifier) @name)) @definition.struct
    (call_expression function: (identifier) @call.name) @call
    (import_declaration (import_spec path: (interpreted_string_literal) @import.source)) @import
  `,
    rust: `
    (function_item name: (identifier) @name) @definition.function
    (struct_item name: (type_identifier) @name) @definition.struct
    (trait_item name: (type_identifier) @name) @definition.trait
    (call_expression function: (identifier) @call.name) @call
    (use_declaration argument: (_) @import.source) @import
  `,
    cpp: `
    (function_definition declarator: (function_declarator declarator: (identifier) @name)) @definition.function
    (class_specifier name: (type_identifier) @name) @definition.class
    (call_expression function: (identifier) @call.name) @call
    (preproc_include path: (_) @import.source) @import
  `,
    csharp: `
    (method_declaration name: (identifier) @name) @definition.method
    (class_declaration name: (identifier) @name) @definition.class
    (interface_declaration name: (identifier) @name) @definition.interface
    (invocation_expression function: (identifier) @call.name) @call
    (using_directive (qualified_name) @import.source) @import
  `,
    php: `
    (function_definition name: (name) @name) @definition.function
    (class_declaration name: (name) @name) @definition.class
    (interface_declaration name: (name) @name) @definition.interface
    (function_call_expression function: (name) @call.name) @call
    (namespace_use_declaration (namespace_use_clause (qualified_name) @import.source)) @import
  `,
    ruby: `
    (method name: (identifier) @name) @definition.method
    (class name: (constant) @name) @definition.class
    (module name: (constant) @name) @definition.module
    (call method: (identifier) @call.name) @call
    (call method: (identifier) @call.name) @import
  `,
    swift: `
    (function_declaration name: (simple_identifier) @name) @definition.function
    (class_declaration "class" name: (type_identifier) @name) @definition.class
    (protocol_declaration name: (type_identifier) @name) @definition.interface
    (call_expression (simple_identifier) @call.name) @call
    (import_declaration (identifier (simple_identifier) @import.source)) @import
  `,
    kotlin: `
    (function_declaration (simple_identifier) @name) @definition.function
    (class_declaration "class" (type_identifier) @name) @definition.class
    (interface_declaration (type_identifier) @name) @definition.interface
    (call_expression (simple_identifier) @call.name) @call
    (import_header (identifier) @import.source) @import
  `,
};

// Get or compile a query for a language
export async function getQuery(
    languageId: LanguageId,
    queryText?: string
): Promise<Parser.Query> {
    const cacheKey = `${languageId}:${queryText?.slice(0, 100) || 'default'}`;
    const cached = queryCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const grammar = await loadLanguage(languageId);
    const queryStr = queryText || QUERY_DEFINITIONS[languageId] || '';
    const query = new Parser.Query(grammar, queryStr);
    queryCache.set(cacheKey, query);
    return query;
}

// Compile and cache a query
export async function compileQuery(
    languageId: LanguageId,
    queryText: string
): Promise<Parser.Query> {
    const grammar = await loadLanguage(languageId);
    const query = new Parser.Query(grammar, queryText);
    const cacheKey = `${languageId}:${queryText.slice(0, 100)}`;
    queryCache.set(cacheKey, query);
    return query;
}

// Clear query cache
export function clearQueryCache(): void {
    queryCache.clear();
}