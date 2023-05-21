import type { LanguageId } from '@codeagent/core-types';
import type { ParserConfig } from './types.js';
import { LanguageRegistry } from './registry.js';

// Parser configuration manager
class ParserConfigManagerImpl {
    private configs: Map<LanguageId, ParserConfig> = new Map();

    register(config: ParserConfig): void {
        this.configs.set(config.languageId, config);
    }

    get(languageId: LanguageId): ParserConfig | undefined {
        return this.configs.get(languageId);
    }

    hasParser(languageId: LanguageId): boolean {
        return this.configs.has(languageId);
    }

    getAvailableParsers(): LanguageId[] {
        return Array.from(this.configs.keys());
    }
}

export const ParserConfigManager = new ParserConfigManagerImpl();

// Register default parser configurations
ParserConfigManager.register({
    languageId: 'typescript',
    grammarModule: 'tree-sitter-typescript',
    queryPath: 'queries/typescript.scm',
    wasmPath: 'tree-sitter-typescript.wasm',
    usesTypescriptGrammar: true,
    tsxSupport: true,
});

ParserConfigManager.register({
    languageId: 'javascript',
    grammarModule: 'tree-sitter-javascript',
    queryPath: 'queries/javascript.scm',
    wasmPath: 'tree-sitter-javascript.wasm',
});

ParserConfigManager.register({
    languageId: 'python',
    grammarModule: 'tree-sitter-python',
    queryPath: 'queries/python.scm',
    wasmPath: 'tree-sitter-python.wasm',
});

ParserConfigManager.register({
    languageId: 'java',
    grammarModule: 'tree-sitter-java',
    queryPath: 'queries/java.scm',
    wasmPath: 'tree-sitter-java.wasm',
});

ParserConfigManager.register({
    languageId: 'go',
    grammarModule: 'tree-sitter-go',
    queryPath: 'queries/go.scm',
    wasmPath: 'tree-sitter-go.wasm',
});

ParserConfigManager.register({
    languageId: 'rust',
    grammarModule: 'tree-sitter-rust',
    queryPath: 'queries/rust.scm',
    wasmPath: 'tree-sitter-rust.wasm',
});

ParserConfigManager.register({
    languageId: 'cpp',
    grammarModule: 'tree-sitter-cpp',
    queryPath: 'queries/cpp.scm',
    wasmPath: 'tree-sitter-cpp.wasm',
});

ParserConfigManager.register({
    languageId: 'csharp',
    grammarModule: 'tree-sitter-c-sharp',
    queryPath: 'queries/csharp.scm',
    wasmPath: 'tree-sitter-c-sharp.wasm',
});

ParserConfigManager.register({
    languageId: 'php',
    grammarModule: 'tree-sitter-php',
    queryPath: 'queries/php.scm',
    wasmPath: 'tree-sitter-php.wasm',
});

ParserConfigManager.register({
    languageId: 'ruby',
    grammarModule: 'tree-sitter-ruby',
    queryPath: 'queries/ruby.scm',
    wasmPath: 'tree-sitter-ruby.wasm',
});

ParserConfigManager.register({
    languageId: 'swift',
    grammarModule: 'tree-sitter-swift',
    queryPath: 'queries/swift.scm',
    wasmPath: 'tree-sitter-swift.wasm',
});

ParserConfigManager.register({
    languageId: 'kotlin',
    grammarModule: 'tree-sitter-kotlin',
    queryPath: 'queries/kotlin.scm',
    wasmPath: 'tree-sitter-kotlin.wasm',
});

// Convenience exports
export function getParserConfig(languageId: LanguageId): ParserConfig | undefined {
    return ParserConfigManager.get(languageId);
}

export function hasParser(languageId: LanguageId): boolean {
    return ParserConfigManager.hasParser(languageId);
}