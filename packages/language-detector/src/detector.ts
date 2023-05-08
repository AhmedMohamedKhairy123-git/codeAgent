import type { LanguageId } from '@codeagent/core-types';
import { LanguageRegistry } from './registry.js';
import type { LanguageDetectionResult, DetectOptions } from './types.js';

// Default detection options
const DEFAULT_OPTIONS: DetectOptions = {
    fallbackLanguage: 'javascript',
    minConfidence: 0.5,
    checkShebang: true,
    checkContent: true,
};

// Detect language from file path and content
export function detectLanguage(
    filePath: string,
    content?: string,
    options: DetectOptions = {}
): LanguageDetectionResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const fileName = filePath.split('/').pop() || filePath;
    const extension = getExtension(filePath);

    // Priority 1: Extension detection (highest confidence)
    if (extension) {
        const langId = LanguageRegistry.getByExtension(extension);
        if (langId) {
            return {
                language: langId,
                confidence: 0.95,
                detectedBy: 'extension',
            };
        }
    }

    // Priority 2: Filename-based detection (special files without extensions)
    const byFilename = detectByFilename(fileName);
    if (byFilename) {
        return {
            language: byFilename,
            confidence: 0.85,
            detectedBy: 'filename',
        };
    }

    // Priority 3: Shebang detection (if content available)
    if (opts.checkShebang && content) {
        const shebang = extractShebang(content);
        if (shebang) {
            const langId = LanguageRegistry.getByShebang(shebang);
            if (langId) {
                return {
                    language: langId,
                    confidence: 0.9,
                    detectedBy: 'shebang',
                };
            }
        }
    }

    // Priority 4: Content-based detection (fallback)
    if (opts.checkContent && content) {
        const byContent = detectByContent(content);
        if (byContent) {
            return {
                language: byContent,
                confidence: 0.7,
                detectedBy: 'content',
            };
        }
    }

    // Final fallback
    return {
        language: opts.fallbackLanguage!,
        confidence: 0.3,
        detectedBy: 'extension',
    };
}

// Get language from file path only (faster)
export function getLanguageFromPath(filePath: string): LanguageId | null {
    const extension = getExtension(filePath);
    if (extension) {
        return LanguageRegistry.getByExtension(extension) || null;
    }
    return detectByFilename(filePath) || null;
}

// Get language from file content only (for content-based detection)
export function getLanguageFromContent(content: string): LanguageId | null {
    const shebang = extractShebang(content);
    if (shebang) {
        const langId = LanguageRegistry.getByShebang(shebang);
        if (langId) return langId;
    }
    return detectByContent(content);
}

// Helper: extract file extension
function getExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
        return null;
    }
    return filePath.slice(lastDot + 1).toLowerCase();
}

// Helper: extract shebang from content
function extractShebang(content: string): string | null {
    if (!content.startsWith('#!')) {
        return null;
    }
    const newlineIdx = content.indexOf('\n');
    if (newlineIdx === -1) {
        return content.slice(2).trim();
    }
    return content.slice(2, newlineIdx).trim();
}

// Helper: detect by special filename patterns
function detectByFilename(fileName: string): LanguageId | null {
    const specialFiles: Record<string, LanguageId> = {
        'Makefile': 'cpp',
        'CMakeLists.txt': 'cpp',
        'Dockerfile': 'javascript',
        'Cargo.toml': 'rust',
        'go.mod': 'go',
        'package.json': 'javascript',
        'composer.json': 'php',
        'Gemfile': 'ruby',
        'Rakefile': 'ruby',
        'Podfile': 'swift',
        'build.gradle': 'kotlin',
        'pom.xml': 'java',
        'requirements.txt': 'python',
        'pyproject.toml': 'python',
    };

    return specialFiles[fileName] || null;
}

// Helper: detect by content patterns
function detectByContent(content: string): LanguageId | null {
    const patterns: Array<{ language: LanguageId; pattern: RegExp; weight: number }> = [
        { language: 'python', pattern: /^\s*import\s+(\w+)/, weight: 0.3 },
        { language: 'python', pattern: /^\s*def\s+\w+\s*\(/, weight: 0.3 },
        { language: 'python', pattern: /^\s*class\s+\w+\s*:/, weight: 0.3 },
        { language: 'java', pattern: /^\s*public\s+class\s+\w+/, weight: 0.4 },
        { language: 'java', pattern: /^\s*package\s+[\w.]+;/, weight: 0.5 },
        { language: 'go', pattern: /^\s*package\s+\w+/, weight: 0.5 },
        { language: 'go', pattern: /^\s*func\s+\w+\s*\(/, weight: 0.3 },
        { language: 'rust', pattern: /^\s*fn\s+\w+\s*\(/, weight: 0.4 },
        { language: 'rust', pattern: /^\s*use\s+[\w:]+;/, weight: 0.3 },
        { language: 'rust', pattern: /^\s*struct\s+\w+/, weight: 0.3 },
        { language: 'cpp', pattern: /^\s*#include\s+[<"]/, weight: 0.4 },
        { language: 'cpp', pattern: /^\s*using\s+namespace\s+\w+;/, weight: 0.3 },
        { language: 'csharp', pattern: /^\s*using\s+[\w.]+;/, weight: 0.4 },
        { language: 'csharp', pattern: /^\s*namespace\s+\w+/, weight: 0.3 },
        { language: 'php', pattern: /^<\?php/, weight: 0.9 },
        { language: 'ruby', pattern: /^\s*require\s+['"]/, weight: 0.3 },
        { language: 'ruby', pattern: /^\s*def\s+\w+/, weight: 0.3 },
        { language: 'swift', pattern: /^\s*import\s+\w+/, weight: 0.3 },
        { language: 'kotlin', pattern: /^\s*package\s+[\w.]+/, weight: 0.4 },
        { language: 'kotlin', pattern: /^\s*fun\s+\w+\s*\(/, weight: 0.3 },
        { language: 'typescript', pattern: /^\s*interface\s+\w+/, weight: 0.4 },
        { language: 'typescript', pattern: /:\s*(string|number|boolean)\b/, weight: 0.2 },
    ];

    let bestMatch: { language: LanguageId; score: number } | null = null;
    const lines = content.split('\n').slice(0, 50); // First 50 lines only

    for (const { language, pattern, weight } of patterns) {
        let matches = 0;
        for (const line of lines) {
            if (pattern.test(line)) {
                matches++;
            }
        }
        const score = matches * weight;
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { language, score };
        }
    }

    return bestMatch && bestMatch.score >= 0.5 ? bestMatch.language : null;
}