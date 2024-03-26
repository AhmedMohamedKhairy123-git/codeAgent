import { describe, it, expect, beforeEach } from 'vitest';
import { HeritageProcessor, processHeritage } from './processor.js';
import { InheritanceGraph, buildInheritanceGraph } from './inheritance-graph.js';
import { computeMRO } from './mro.js';
import type { GraphNode, HeritageEdge } from '@codeagent/core-types';

describe('HeritageProcessor', () => {
    let processor: HeritageProcessor;
    let symbols: GraphNode[];

    beforeEach(() => {
        processor = new HeritageProcessor();
        symbols = [
            {
                id: 'Class:src/animal.ts:Animal',
                kind: 'Class',
                name: 'Animal',
                filePath: 'src/animal.ts',
                startLine: 1,
                endLine: 10,
                language: 'typescript',
                isExported: true,
            },
            {
                id: 'Class:src/dog.ts:Dog',
                kind: 'Class',
                name: 'Dog',
                filePath: 'src/dog.ts',
                startLine: 1,
                endLine: 15,
                language: 'typescript',
                isExported: true,
            },
            {
                id: 'Interface:src/animal.ts:Pet',
                kind: 'Interface',
                name: 'Pet',
                filePath: 'src/animal.ts',
                startLine: 12,
                endLine: 18,
                language: 'typescript',
                isExported: true,
            },
        ];
        processor.addSymbols(symbols);
    });

    describe('HeritageProcessor', () => {
        it('processes TypeScript extends', async () => {
            const content = `
        import { Animal } from './animal';
        
        export class Dog extends Animal {
          bark() {
            return "woof";
          }
        }
      `;

            processor.addImport('src/dog.ts', 'src/animal.ts');
            const edges = await processor.processFile('src/dog.ts', content);

            expect(edges.length).toBeGreaterThan(0);
            expect(edges[0].kind).toBe('extends');
            expect(edges[0].sourceId).toContain('Dog');
            expect(edges[0].targetId).toContain('Animal');
        });

        it('processes TypeScript implements', async () => {
            const content = `
        import { Pet } from './animal';
        
        export class Dog implements Pet {
          play() {
            return "playing";
          }
        }
      `;

            processor.addImport('src/dog.ts', 'src/animal.ts');
            const edges = await processor.processFile('src/dog.ts', content);

            expect(edges.length).toBeGreaterThan(0);
            expect(edges[0].kind).toBe('implements');
        });

        it('processes Python inheritance', async () => {
            const content = `
        class Animal:
            pass
        
        class Dog(Animal):
            def bark(self):
                return "woof"
      `;

            const edges = await processor.processFile('src/animal.py', content);
            expect(edges.length).toBeGreaterThan(0);
        });

        it('processes Java inheritance', async () => {
            const content = `
        public class Dog extends Animal implements Pet {
            public void bark() {}
        }
      `;

            const edges = await processor.processFile('src/Dog.java', content);
            expect(edges.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('InheritanceGraph', () => {
        let graph: InheritanceGraph;
        let edges: HeritageEdge[];

        beforeEach(() => {
            edges = [
                {
                    sourceId: 'Class:src/dog.ts:Dog',
                    targetId: 'Class:src/animal.ts:Animal',
                    kind: 'extends',
                    confidence: 1.0,
                    sourceFile: 'src/dog.ts',
                    targetFile: 'src/animal.ts',
                },
                {
                    sourceId: 'Class:src/dog.ts:Dog',
                    targetId: 'Interface:src/animal.ts:Pet',
                    kind: 'implements',
                    confidence: 0.95,
                    sourceFile: 'src/dog.ts',
                    targetFile: 'src/animal.ts',
                },
            ];

            graph = buildInheritanceGraph(symbols, edges);
        });

        it('gets parents', () => {
            const parents = graph.getParents('Class:src/dog.ts:Dog');
            expect(parents.length).toBe(1);
            expect(parents[0].name).toBe('Animal');
        });

        it('gets interfaces', () => {
            const interfaces = graph.getInterfaces('Class:src/dog.ts:Dog');
            expect(interfaces.length).toBe(1);
            expect(interfaces[0].name).toBe('Pet');
        });

        it('checks subclass relationship', () => {
            const isSubclass = graph.isSubclassOf(
                'Class:src/dog.ts:Dog',
                'Class:src/animal.ts:Animal'
            );
            expect(isSubclass).toBe(true);
        });

        it('gets ancestors', () => {
            const ancestors = graph.getAncestors('Class:src/dog.ts:Dog');
            expect(ancestors.length).toBe(1);
        });
    });

    describe('MRO', () => {
        let graph: InheritanceGraph;
        let edges: HeritageEdge[];

        beforeEach(() => {
            edges = [
                {
                    sourceId: 'Class:B',
                    targetId: 'Class:A',
                    kind: 'extends',
                    confidence: 1.0,
                    sourceFile: 'b.ts',
                    targetFile: 'a.ts',
                },
                {
                    sourceId: 'Class:C',
                    targetId: 'Class:B',
                    kind: 'extends',
                    confidence: 1.0,
                    sourceFile: 'c.ts',
                    targetFile: 'b.ts',
                },
            ];

            const symbols = [
                { id: 'Class:A', kind: 'Class' as const, name: 'A', filePath: 'a.ts' },
                { id: 'Class:B', kind: 'Class' as const, name: 'B', filePath: 'b.ts' },
                { id: 'Class:C', kind: 'Class' as const, name: 'C', filePath: 'c.ts' },
            ];

            graph = buildInheritanceGraph(symbols as GraphNode[], edges);
        });

        it('computes linearization for single inheritance', () => {
            const result = computeMRO('Class:C', graph);
            expect(result.linearization).toContain('Class:C');
            expect(result.linearization).toContain('Class:B');
            expect(result.linearization).toContain('Class:A');
        });
    });
});