import { describe, it, expect } from 'vitest';
import { detectLanguage, getLanguageFromPath, getLanguageFromContent } from './detector.js';
import { getSupportedLanguages, isLanguageSupported } from './registry.js';

describe('LanguageDetector', () => {
    describe('detectLanguage', () => {
        it('detects TypeScript by extension', () => {
            const result = detectLanguage('src/index.ts', '');
            expect(result.language).toBe('typescript');
            expect(result.confidence).toBe(0.95);
            expect(result.detectedBy).toBe('extension');
        });

        it('detects JavaScript by extension', () => {
            const result = detectLanguage('src/index.js', '');
            expect(result.language).toBe('javascript');
        });

        it('detects Python by extension', () => {
            const result = detectLanguage('script.py', '');
            expect(result.language).toBe('python');
        });

        it('detects Python by shebang', () => {
            const content = '#!/usr/bin/env python3\nprint("hello")';
            const result = detectLanguage('script', content);
            expect(result.language).toBe('python');
            expect(result.detectedBy).toBe('shebang');
        });

        it('detects Ruby by shebang', () => {
            const content = '#!/usr/bin/env ruby\nputs "hello"';
            const result = detectLanguage('script', content);
            expect(result.language).toBe('ruby');
        });

        it('detects PHP by opening tag', () => {
            const content = '<?php echo "hello"; ?>';
            const result = detectLanguage('file.php', content);
            expect(result.language).toBe('php');
        });

        it('detects special files by filename', () => {
            const result = detectLanguage('Dockerfile', 'FROM node');
            expect(result.language).toBe('javascript');
        });

        it('falls back to default language', () => {
            const result = detectLanguage('unknown.xyz', '', { fallbackLanguage: 'javascript' });
            expect(result.language).toBe('javascript');
            expect(result.confidence).toBe(0.3);
        });
    });

    describe('getLanguageFromPath', () => {
        it('returns language from extension', () => {
            expect(getLanguageFromPath('app.ts')).toBe('typescript');
            expect(getLanguageFromPath('app.tsx')).toBe('typescript');
            expect(getLanguageFromPath('app.js')).toBe('javascript');
            expect(getLanguageFromPath('app.py')).toBe('python');
            expect(getLanguageFromPath('Main.java')).toBe('java');
            expect(getLanguageFromPath('main.go')).toBe('go');
            expect(getLanguageFromPath('lib.rs')).toBe('rust');
        });

        it('returns null for unknown extension', () => {
            expect(getLanguageFromPath('file.xyz')).toBeNull();
        });

        it('handles special filenames', () => {
            expect(getLanguageFromPath('Makefile')).toBe('cpp');
            expect(getLanguageFromPath('Cargo.toml')).toBe('rust');
            expect(getLanguageFromPath('go.mod')).toBe('go');
        });
    });

    describe('getLanguageFromContent', () => {
        it('detects from shebang', () => {
            expect(getLanguageFromContent('#!/usr/bin/env python3')).toBe('python');
            expect(getLanguageFromContent('#!/usr/bin/env ruby')).toBe('ruby');
        });

        it('detects PHP from opening tag', () => {
            expect(getLanguageFromContent('<?php')).toBe('php');
        });

        it('returns null for unknown content', () => {
            expect(getLanguageFromContent('random text')).toBeNull();
        });
    });

    describe('Registry', () => {
        it('returns supported languages', () => {
            const langs = getSupportedLanguages();
            expect(langs).toContain('typescript');
            expect(langs).toContain('python');
            expect(langs).toContain('rust');
        });

        it('checks language support', () => {
            expect(isLanguageSupported('typescript')).toBe(true);
            expect(isLanguageSupported('unknown')).toBe(false);
        });
    });
});