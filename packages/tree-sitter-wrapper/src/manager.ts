import Parser from 'tree-sitter';
import type { LanguageId } from '@codeagent/core-types';
import { loadLanguage } from './language-loader.js';
import type { ParserHandle, ParseOptions } from './types.js';

// Maximum idle time before parser is closed (5 minutes)
const PARSER_IDLE_TIMEOUT = 5 * 60 * 1000;

// Parser pool
const parserPool = new Map<LanguageId, ParserHandle[]>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Start cleanup interval
function startCleanup(): void {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [langId, handles] of parserPool) {
            const activeHandles = handles.filter(h => now - h.lastUsed < PARSER_IDLE_TIMEOUT);
            const removed = handles.length - activeHandles.length;
            if (removed > 0) {
                parserPool.set(langId, activeHandles);
            }
        }
    }, 60000); // Check every minute
    if (cleanupInterval.unref) cleanupInterval.unref();
}

// Get or create a parser for a language
export async function getParser(languageId: LanguageId, filePath?: string): Promise<ParserHandle> {
    startCleanup();

    const pool = parserPool.get(languageId) || [];
    const now = Date.now();

    // Reuse existing parser if available
    for (const handle of pool) {
        if (now - handle.lastUsed < PARSER_IDLE_TIMEOUT) {
            handle.lastUsed = now;
            return handle;
        }
    }

    // Create new parser
    const grammar = await loadLanguage(languageId, filePath);
    const parser = new Parser();
    parser.setLanguage(grammar);

    const handle: ParserHandle = {
        parser,
        languageId,
        lastUsed: now,
    };

    parserPool.set(languageId, [...pool, handle]);
    return handle;
}

// Create a parser and immediately parse content
export async function createParser(
    languageId: LanguageId,
    content: string,
    options: ParseOptions = {},
    filePath?: string
): Promise<{ parser: Parser; tree: Parser.Tree }> {
    const { parser } = await getParser(languageId, filePath);
    const bufferSize = options.bufferSize || 512 * 1024;

    let tree: Parser.Tree;
    if (options.timeout && options.timeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Parsing timeout after ${options.timeout}ms`)), options.timeout);
        });
        tree = await Promise.race([
            parser.parse(content, undefined, { bufferSize }),
            timeoutPromise,
        ]);
    } else {
        tree = parser.parse(content, undefined, { bufferSize });
    }

    return { parser, tree };
}

// Dispose a parser (remove from pool)
export function disposeParser(languageId: LanguageId, parser: Parser): void {
    const pool = parserPool.get(languageId) || [];
    const index = pool.findIndex(h => h.parser === parser);
    if (index !== -1) {
        pool.splice(index, 1);
        parserPool.set(languageId, pool);
    }
    try {
        parser.delete();
    } catch {
        // Ignore deletion errors
    }
}

// Dispose all parsers (for cleanup)
export function disposeAllParsers(): void {
    for (const [_, handles] of parserPool) {
        for (const handle of handles) {
            try {
                handle.parser.delete();
            } catch {
                // Ignore
            }
        }
    }
    parserPool.clear();
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}