import type { LanguageId } from '@codeagent/core-types';
import type Parser from 'tree-sitter';
import { isLanguageSupported as isLangSupported } from '@codeagent/language-detector';

// Import language modules dynamically
const languageModules: Record<string, () => Promise<any>> = {
    javascript: () => import('tree-sitter-javascript'),
    typescript: () => import('tree-sitter-typescript'),
    python: () => import('tree-sitter-python'),
    java: () => import('tree-sitter-java'),
    go: () => import('tree-sitter-go'),
    rust: () => import('tree-sitter-rust'),
    cpp: () => import('tree-sitter-cpp'),
    csharp: () => import('tree-sitter-c-sharp'),
    php: () => import('tree-sitter-php'),
    ruby: () => import('tree-sitter-ruby'),
    swift: () => import('tree-sitter-swift'),
    kotlin: () => import('tree-sitter-kotlin'),
};

// Cache loaded languages
const languageCache = new Map<LanguageId, Parser.Language>();

// Check if a language grammar is available
export function isLanguageAvailable(languageId: LanguageId): boolean {
    return languageId in languageModules;
}

// Load a language grammar
export async function loadLanguage(languageId: LanguageId, filePath?: string): Promise<Parser.Language> {
    // Check cache first
    const cached = languageCache.get(languageId);
    if (cached) {
        return cached;
    }

    const loader = languageModules[languageId];
    if (!loader) {
        throw new Error(`No grammar available for language: ${languageId}`);
    }

    try {
        const module = await loader();

        let grammar: Parser.Language;

        // Handle different module exports
        if (languageId === 'typescript') {
            const isTsx = filePath?.endsWith('.tsx') ?? false;
            grammar = isTsx ? module.tsx : module.typescript;
        } else if (languageId === 'php') {
            grammar = module.php_only;
        } else {
            grammar = module;
        }

        languageCache.set(languageId, grammar);
        return grammar;
    } catch (error) {
        throw new Error(`Failed to load grammar for ${languageId}: ${error}`);
    }
}

// Preload commonly used languages
export async function preloadLanguages(languages: LanguageId[]): Promise<void> {
    await Promise.all(languages.map(lang => loadLanguage(lang).catch(() => null)));
}

// Get loaded languages
export function getLoadedLanguages(): LanguageId[] {
    return Array.from(languageCache.keys());
}

// Clear language cache
export function clearLanguageCache(): void {
    languageCache.clear();
}