import type { LanguageId } from '@codeagent/core-types';

// Language configuration
export interface LanguageConfig {
    id: LanguageId;
    name: string;
    extensions: string[];
    shebangPatterns?: RegExp[];
    magicBytes?: Uint8Array[];
    commentStyle: {
        line?: string;
        block?: [string, string];
    };
    treeSitterGrammar?: string;
    isBinary?: boolean;
}

// Parser configuration for tree-sitter
export interface ParserConfig {
    languageId: LanguageId;
    grammarModule: string;
    queryPath?: string;
    wasmPath?: string;
    usesTypescriptGrammar?: boolean;
    tsxSupport?: boolean;
}

// Detection result
export interface LanguageDetectionResult {
    language: LanguageId;
    confidence: number;
    detectedBy: 'extension' | 'shebang' | 'content' | 'filename';
}

// Detection options
export interface DetectOptions {
    fallbackLanguage?: LanguageId;
    minConfidence?: number;
    checkShebang?: boolean;
    checkContent?: boolean;
}