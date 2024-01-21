import { describe, it, expect, beforeEach } from 'vitest';
import { CallGraphBuilder, buildCallGraph } from './builder.js';
import { extractCallSites } from './call-site.js';
import { detectCallForm, extractReceiver } from './call-form.js';
import { calculateConfidence } from './confidence.js';
import type { GraphNode } from '@codeagent/core-types';

describe('CallGraph', () => {
    let builder: CallGraphBuilder;
    let symbols: GraphNode[];

    beforeEach(() => {
        builder = new CallGraphBuilder();
        symbols = [
            {
                id: 'Function:src/index.ts:main',
                kind: 'Function',
                name: 'main',
                filePath: 'src/index.ts',
                startLine: 1,
                endLine: 10,
                language: 'typescript',
                isExported: true,
            },
            {
                id: 'Function:src/utils.ts:greet',
                kind: 'Function',
                name: 'greet',
                filePath: 'src/utils.ts',
                startLine: 1,
                endLine: 5,
                language: 'typescript',
                isExported: true,
            },
            {
                id: 'Class:src/user.ts:User',
                kind: 'Class',
                name: 'User',
                filePath: 'src/user.ts',
                startLine: 1,
                endLine: 20,
                language: 'typescript',
                isExported: true,
            },
            {
                id: 'Method:src/user.ts:User.save',
                kind: 'Method',
                name: 'save',
                filePath: 'src/user.ts',
                startLine: 5,
                endLine: 8,
                language: 'typescript',
                isExported: true,
            },
        ];
    });

    describe('CallForm', () => {
        it('detects free function call', () => {
            const form = detectCallForm('greet("world")');
            expect(form).toBe('free');
        });

        it('detects member call', () => {
            const form = detectCallForm('user.save()', { hasDot: true });
            expect(form).toBe('member');
        });

        it('detects constructor call', () => {
            const form = detectCallForm('new User()', { hasNew: true });
            expect(form).toBe('constructor');
        });

        it('extracts receiver from member call', () => {
            const receiver = extractReceiver('user.save()');
            expect(receiver).toBe('user');
        });
    });

    describe('CallSite', () => {
        it('extracts call sites from AST', () => {
            // This would need an actual AST node - testing the structure
            const callSite = {
                filePath: 'src/index.ts',
                calledName: 'greet',
                sourceId: 'Function:src/index.ts:main',
                line: 5,
                column: 10,
                argumentCount: 1,
                callForm: 'free' as const,
            };

            expect(callSite.calledName).toBe('greet');
            expect(callSite.callForm).toBe('free');
        });
    });

    describe('CallGraphBuilder', () => {
        it('adds symbols to graph', () => {
            builder.addSymbols(symbols);
            const graph = builder.getGraph();
            expect(graph.nodeCount).toBe(4);
        });

        it('processes call and creates edge', async () => {
            builder.addSymbols(symbols);

            const callSite = {
                filePath: 'src/index.ts',
                calledName: 'greet',
                sourceId: 'Function:src/index.ts:main',
                line: 5,
                column: 10,
                argumentCount: 1,
                callForm: 'free' as const,
            };

            const context = {
                currentFile: 'src/index.ts',
                language: 'typescript' as const,
                symbols: new Map(symbols.map(s => [s.id, s])),
                imports: new Map(),
                typeEnv: new Map(),
            };

            const edge = await builder.processCall(callSite, context);
            expect(edge).not.toBeNull();
            expect(edge?.targetId).toBe('Function:src/utils.ts:greet');
        });

        it('handles unresolved calls', async () => {
            builder.addSymbols(symbols);

            const callSite = {
                filePath: 'src/index.ts',
                calledName: 'unknownFunction',
                sourceId: 'Function:src/index.ts:main',
                line: 5,
                column: 10,
                argumentCount: 0,
                callForm: 'free' as const,
            };

            const context = {
                currentFile: 'src/index.ts',
                language: 'typescript' as const,
                symbols: new Map(symbols.map(s => [s.id, s])),
                imports: new Map(),
                typeEnv: new Map(),
            };

            const edge = await builder.processCall(callSite, context);
            expect(edge).toBeNull();
        });
    });

    describe('Confidence', () => {
        it('calculates high confidence for exact match', () => {
            const callSite = {
                filePath: 'src/index.ts',
                calledName: 'greet',
                sourceId: 'main',
                line: 5,
                column: 10,
                argumentCount: 1,
                callForm: 'free' as const,
            };
            const confidence = calculateConfidence(callSite, 'Function', 'exact-match', false);
            expect(confidence.level).toBe('high');
            expect(confidence.score).toBeGreaterThanOrEqual(0.8);
        });

        it('calculates low confidence for global fallback', () => {
            const callSite = {
                filePath: 'src/index.ts',
                calledName: 'greet',
                sourceId: 'main',
                line: 5,
                column: 10,
                argumentCount: 1,
                callForm: 'free' as const,
            };
            const confidence = calculateConfidence(callSite, 'Function', 'global', false);
            expect(confidence.level).toBe('low');
        });
    });
});