import type { LanguageId } from '@codeagent/core-types';
import type { LanguageConfig } from './types.js';
import { DEFAULT_LANGUAGES } from './languages.js';

// Singleton language registry
class LanguageRegistryImpl {
    private languages: Map<LanguageId, LanguageConfig> = new Map();
    private extensionMap: Map<string, LanguageId> = new Map();
    private shebangMap: Map<RegExp, LanguageId> = new Map();

    constructor() {
        // Register default languages
        for (const lang of DEFAULT_LANGUAGES) {
            this.register(lang);
        }
    }

    register(config: LanguageConfig): void {
        this.languages.set(config.id, config);

        // Index extensions (case-insensitive)
        for (const ext of config.extensions) {
            const normalized = ext.toLowerCase();
            this.extensionMap.set(normalized, config.id);
        }

        // Index shebang patterns
        for (const pattern of config.shebangPatterns || []) {
            this.shebangMap.set(pattern, config.id);
        }
    }

    get(id: LanguageId): LanguageConfig | undefined {
        return this.languages.get(id);
    }

    getByExtension(extension: string): LanguageId | undefined {
        const normalized = extension.toLowerCase().replace(/^\./, '');
        return this.extensionMap.get(normalized);
    }

    getByShebang(shebang: string): LanguageId | undefined {
        for (const [pattern, langId] of this.shebangMap) {
            if (pattern.test(shebang)) {
                return langId;
            }
        }
        return undefined;
    }

    getAll(): LanguageConfig[] {
        return Array.from(this.languages.values());
    }

    getSupportedIds(): LanguageId[] {
        return Array.from(this.languages.keys());
    }

    has(id: LanguageId): boolean {
        return this.languages.has(id);
    }

    isSupported(id: LanguageId): boolean {
        return this.languages.has(id);
    }
}

// Singleton instance
export const LanguageRegistry = new LanguageRegistryImpl();

// Convenience exports
export function registerLanguage(config: LanguageConfig): void {
    LanguageRegistry.register(config);
}

export function getSupportedLanguages(): LanguageId[] {
    return LanguageRegistry.getSupportedIds();
}

export function isLanguageSupported(id: LanguageId): boolean {
    return LanguageRegistry.has(id);
}