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
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { ImportResolver, resolveImport, resolveImportsBatch } from './resolver.js';
import { createFileIndex, findFileBySuffix, findFilesInDirectory } from './file-index.js';
import { createPathMapper, resolvePathAlias } from './path-mapper.js';

describe('ImportResolver', () => {
    let files: string[];
    let rootPath: string;

    beforeEach(() => {
        rootPath = '/project';
        files = [
            'src/index.ts',
            'src/utils/helpers.ts',
            'src/components/Button.tsx',
            'lib/helpers.js',
            'package.json',
        ];
    });

    describe('FileIndex', () => {
        it('creates index from file list', () => {
            const index = createFileIndex(files, rootPath);

            expect(index.paths.has('/project/src/index.ts')).toBe(true);
            expect(index.paths.has('src/index.ts')).toBe(true);
            expect(index.paths.has('index.ts')).toBe(true);
        });

        it('finds file by suffix', () => {
            const index = createFileIndex(files, rootPath);
            const extensions = ['.ts', '.tsx'];

            const found = findFileBySuffix(index, 'utils/helpers', extensions);
            expect(found).toContain('helpers.ts');
        });

        it('finds files in directory', () => {
            const index = createFileIndex(files, rootPath);
            const filesInDir = findFilesInDirectory(index, 'src');

            expect(filesInDir.length).toBeGreaterThan(0);
        });
    });

    describe('PathMapper', () => {
        it('resolves path aliases', () => {
            const aliases = new Map([['@', 'src']]);
            const mapper = createPathMapper(aliases, rootPath);

            const result = mapper.mapAlias('@/utils/helpers');
            expect(result).toBe('src/utils/helpers');
        });

        it('resolves relative paths', () => {
            const aliases = new Map();
            const mapper = createPathMapper(aliases, rootPath);

            const result = mapper.resolveRelative('/project/src/index.ts', './utils/helpers');
            expect(result).toBe('/project/src/utils/helpers');
        });
    });

    describe('ImportResolver', () => {
        let resolver: ImportResolver;

        beforeEach(() => {
            resolver = new ImportResolver(files, rootPath);
        });

        it('resolves relative imports', async () => {
            const result = await resolver.resolve('./utils/helpers', '/project/src/index.ts');

            expect(result.resolved).toBe(true);
            expect(result.resolvedPath).toContain('helpers.ts');
            expect(result.resolutionMethod).toBe('relative');
        });

        it('resolves sibling imports', async () => {
            const result = await resolver.resolve('./helpers', '/project/src/utils/index.ts');

            expect(result.resolved).toBe(true);
            expect(result.resolvedPath).toContain('helpers.ts');
        });

        it('returns unresolved for missing imports', async () => {
            const result = await resolver.resolve('./missing', '/project/src/index.ts');

            expect(result.resolved).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('handles path aliases', async () => {
            const aliasResolver = new ImportResolver(files, rootPath, new Map([['@', 'src']]));
            const result = await aliasResolver.resolve('@/utils/helpers', '/project/src/index.ts');

            expect(result.resolved).toBe(true);
            expect(result.resolutionMethod).toBe('path-alias');
        });
    });

    describe('Language-specific resolvers', () => {
        it('resolves Python relative imports', async () => {
            const pythonFiles = ['app/models/user.py', 'app/__init__.py', 'app/services/auth.py'];
            const resolver = new ImportResolver(pythonFiles, rootPath);
            const result = await resolver.resolve(
                '.models.user',
                '/project/app/services/auth.py',
                'python'
            );

            expect(result.resolved).toBe(true);
            expect(result.resolvedPath).toContain('models/user.py');
        });

        it('resolves Go imports', async () => {
            const goFiles = ['cmd/main.go', 'internal/auth/handler.go', 'pkg/utils/helper.go'];
            const resolver = new ImportResolver(goFiles, rootPath);
            const result = await resolver.resolve(
                'internal/auth',
                '/project/cmd/main.go',
                'go'
            );

            expect(result.resolved).toBe(true);
            expect(result.resolutionMethod).toBe('directory');
        });

        it('resolves Rust crate imports', async () => {
            const rustFiles = ['src/main.rs', 'src/lib.rs', 'src/models/user.rs'];
            const resolver = new ImportResolver(rustFiles, rootPath);
            const result = await resolver.resolve(
                'crate::models::user',
                '/project/src/main.rs',
                'rust'
            );

            expect(result.resolved).toBe(true);
            expect(result.resolutionMethod).toBe('crate');
        });
    });

    describe('Batch resolution', () => {
        it('resolves multiple imports', async () => {
            const imports = ['./utils/helpers', './missing', '@src/index'];
            const aliases = new Map([['@src', 'src']]);
            const resolver = new ImportResolver(files, rootPath, aliases);
            const result = await resolver.resolveBatch(imports, '/project/src/index.ts');

            expect(result.stats.total).toBe(3);
            expect(result.stats.resolved).toBe(2);
            expect(result.stats.unresolved).toBe(1);
            expect(result.unresolved).toContain('./missing');
        });
    });
});