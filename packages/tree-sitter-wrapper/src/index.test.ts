import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createParser, getParser, disposeAllParsers } from './manager.js';
import { getQuery, compileQuery, clearQueryCache } from './query-cache.js';
import { walkTree, collectNodes, serializeNode, getNodeDepth } from './ast-walker.js';

describe('TreeSitterWrapper', () => {
    afterEach(() => {
        disposeAllParsers();
        clearQueryCache();
    });

    describe('ParserManager', () => {
        it('creates parser for JavaScript', async () => {
            const content = 'function hello() { return "world"; }';
            const { parser, tree } = await createParser('javascript', content);

            expect(parser).toBeDefined();
            expect(tree).toBeDefined();
            expect(tree.rootNode.type).toBe('program');
            expect(tree.rootNode.text).toBe(content);
        });

        it('creates parser for TypeScript', async () => {
            const content = 'const x: number = 5;';
            const { parser, tree } = await createParser('typescript', content);

            expect(parser).toBeDefined();
            expect(tree).toBeDefined();
            expect(tree.rootNode.type).toBe('program');
        });

        it('reuses parsers from pool', async () => {
            const handle1 = await getParser('javascript');
            const handle2 = await getParser('javascript');

            expect(handle1.parser).toBe(handle2.parser);
        });

        it('parses with timeout', async () => {
            const content = 'function test() { return 42; }';
            const { tree } = await createParser('javascript', content, { timeout: 1000 });

            expect(tree).toBeDefined();
        });
    });

    describe('QueryCache', () => {
        it('returns query for language', async () => {
            const query = await getQuery('javascript');
            expect(query).toBeDefined();
        });

        it('compiles custom query', async () => {
            const customQuery = '(function_declaration) @func';
            const query = await compileQuery('javascript', customQuery);
            expect(query).toBeDefined();
        });

        it('caches compiled queries', async () => {
            const query1 = await getQuery('javascript');
            const query2 = await getQuery('javascript');
            expect(query1).toBe(query2);
        });
    });

    describe('ASTWalker', () => {
        let tree: any;
        let root: any;

        beforeEach(async () => {
            const content = `
        function foo() {
          const x = 5;
          return x * 2;
        }

        class Bar {
          baz() {
            return "hello";
          }
        }
      `;
            const { tree: t } = await createParser('javascript', content);
            tree = t;
            root = tree.rootNode;
        });

        it('walks tree and collects nodes', () => {
            const functions = walkTree(root, (n) => n.type === 'function_declaration');
            expect(functions.length).toBe(1);
            expect(functions[0].text).toContain('function foo');
        });

        it('collects nodes by type', () => {
            const functions = collectNodes(root, 'function_declaration');
            const classes = collectNodes(root, 'class_declaration');

            expect(functions.length).toBe(1);
            expect(classes.length).toBe(1);
        });

        it('serializes node to JSON', () => {
            const func = collectNodes(root, 'function_declaration')[0];
            const serialized = serializeNode(func);

            expect(serialized.type).toBe('function_declaration');
            expect(serialized.isNamed).toBe(true);
            expect(serialized.children.length).toBeGreaterThan(0);
        });

        it('calculates node depth', () => {
            const func = collectNodes(root, 'function_declaration')[0];
            const depth = getNodeDepth(func);

            expect(depth).toBeGreaterThan(0);
        });
    });
});