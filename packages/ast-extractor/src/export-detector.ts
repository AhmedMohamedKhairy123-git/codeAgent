import type { LanguageId } from '@codeagent/core-types';
import type Parser from 'tree-sitter';

// Export detection strategies per language
const exportStrategies: Record<LanguageId, (node: Parser.SyntaxNode, name: string) => boolean> = {
    javascript: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            if (current.type === 'export_statement' || current.type === 'export_specifier') {
                return true;
            }
            if (current.type === 'lexical_declaration' && current.parent?.type === 'export_statement') {
                return true;
            }
            current = current.parent;
        }
        return false;
    },

    typescript: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            if (current.type === 'export_statement') return true;
            if (current.type === 'export_specifier') return true;
            if (current.type === 'lexical_declaration' && current.parent?.type === 'export_statement') return true;
            current = current.parent;
        }
        return false;
    },

    python: (node, name) => {
        // Python: no explicit export, but underscore prefix = private
        return !name.startsWith('_');
    },

    java: (node) => {
        let current: Parser.SyntaxNode | null = node.parent;
        while (current) {
            for (let i = 0; i < current.childCount; i++) {
                const child = current.child(i);
                if (child?.type === 'modifiers' && child.text?.includes('public')) {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    },

    go: (node, name) => {
        // Go: uppercase first letter = exported
        return name.length > 0 && name[0] === name[0].toUpperCase();
    },

    rust: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            for (let i = 0; i < current.childCount; i++) {
                const child = current.child(i);
                if (child?.type === 'visibility_modifier' && child.text?.startsWith('pub')) {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    },

    cpp: (node) => {
        // C++: check for public access specifier
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            if (current.type === 'access_specifier' && current.text === 'public') {
                return true;
            }
            current = current.parent;
        }
        // Functions without static have external linkage
        return true;
    },

    csharp: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            for (let i = 0; i < current.childCount; i++) {
                const child = current.child(i);
                if (child?.type === 'modifier' && child.text === 'public') {
                    return true;
                }
            }
            current = current.parent;
        }
        return false;
    },

    php: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            if (current.type === 'visibility_modifier' && current.text === 'public') {
                return true;
            }
            if (current.type === 'class_declaration' || current.type === 'function_definition') {
                return true; // Top-level functions/classes are public
            }
            current = current.parent;
        }
        return true;
    },

    ruby: () => true, // Ruby: all methods are public by default

    swift: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            if (current.type === 'modifiers') {
                const text = current.text || '';
                if (text.includes('public') || text.includes('open')) return true;
            }
            current = current.parent;
        }
        return false;
    },

    kotlin: (node) => {
        let current: Parser.SyntaxNode | null = node;
        while (current) {
            for (let i = 0; i < current.childCount; i++) {
                const child = current.child(i);
                if (child?.type === 'visibility_modifier') {
                    const text = child.text;
                    if (text === 'private' || text === 'internal' || text === 'protected') return false;
                    if (text === 'public') return true;
                }
            }
            current = current.parent;
        }
        return true; // Kotlin default visibility is public
    },
};

// Check if a symbol is exported
export function isExported(node: Parser.SyntaxNode, name: string, language: LanguageId): boolean {
    const strategy = exportStrategies[language];
    if (!strategy) return false;
    return strategy(node, name);
}

// Get export status with reason
export function getExportStatus(node: Parser.SyntaxNode, name: string, language: LanguageId): {
    exported: boolean;
    reason: string;
} {
    const exported = isExported(node, name, language);
    let reason = '';

    switch (language) {
        case 'go':
            reason = exported ? 'uppercase first letter' : 'lowercase first letter';
            break;
        case 'python':
            reason = exported ? 'no underscore prefix' : 'underscore prefix';
            break;
        case 'java':
        case 'csharp':
            reason = exported ? 'public modifier' : 'no public modifier';
            break;
        case 'rust':
            reason = exported ? 'pub keyword' : 'no pub keyword';
            break;
        default:
            reason = exported ? 'exported' : 'not exported';
    }

    return { exported, reason };
}