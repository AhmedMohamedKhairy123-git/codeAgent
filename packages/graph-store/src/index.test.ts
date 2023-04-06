import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphStore, query, findPaths } from './index.js';
import type { GraphNode, GraphEdge } from '@codeagent/core-types';

describe('GraphStore', () => {
    let store = createGraphStore();

    beforeEach(() => {
        store = createGraphStore();
    });

    it('adds and retrieves nodes', () => {
        const node: GraphNode = {
            id: 'func:test',
            kind: 'Function',
            name: 'test',
            filePath: 'src/test.ts',
        };
        store = store.addNode(node);
        expect(store.nodeCount).toBe(1);
        expect(store.getNode('func:test')).toEqual(node);
    });

    it('adds and retrieves edges', () => {
        const nodeA: GraphNode = { id: 'a', kind: 'Function', name: 'a', filePath: 'src/a.ts' };
        const nodeB: GraphNode = { id: 'b', kind: 'Function', name: 'b', filePath: 'src/b.ts' };
        const edge: GraphEdge = {
            id: 'a->b',
            sourceId: 'a',
            targetId: 'b',
            kind: 'CALLS',
            confidence: 1.0,
        };

        store = store.addNode(nodeA).addNode(nodeB).addEdge(edge);
        expect(store.edgeCount).toBe(1);
        expect(store.getOutgoing('a')[0]).toEqual(edge);
        expect(store.getIncoming('b')[0]).toEqual(edge);
    });

    it('filters nodes by kind', () => {
        const func: GraphNode = { id: 'f1', kind: 'Function', name: 'foo', filePath: 'src/foo.ts' };
        const cls: GraphNode = { id: 'c1', kind: 'Class', name: 'Bar', filePath: 'src/bar.ts' };
        store = store.addNode(func).addNode(cls);

        const functions = store.findNodes({ kind: 'Function' });
        expect(functions).toHaveLength(1);
        expect(functions[0].id).toBe('f1');
    });

    it('removes nodes and cascades edges', () => {
        const nodeA: GraphNode = { id: 'a', kind: 'Function', name: 'a', filePath: 'src/a.ts' };
        const nodeB: GraphNode = { id: 'b', kind: 'Function', name: 'b', filePath: 'src/b.ts' };
        const edge: GraphEdge = { id: 'a->b', sourceId: 'a', targetId: 'b', kind: 'CALLS', confidence: 1.0 };

        store = store.addNode(nodeA).addNode(nodeB).addEdge(edge);
        store = store.removeNode('a');

        expect(store.nodeCount).toBe(1);
        expect(store.edgeCount).toBe(0);
    });

    it('finds shortest path', () => {
        const nodes = ['a', 'b', 'c', 'd'].map(id => ({
            id,
            kind: 'Function' as const,
            name: id,
            filePath: `src/${id}.ts`,
        }));
        const edges: GraphEdge[] = [
            { id: 'a->b', sourceId: 'a', targetId: 'b', kind: 'CALLS', confidence: 1.0 },
            { id: 'b->c', sourceId: 'b', targetId: 'c', kind: 'CALLS', confidence: 1.0 },
            { id: 'c->d', sourceId: 'c', targetId: 'd', kind: 'CALLS', confidence: 1.0 },
            { id: 'a->d', sourceId: 'a', targetId: 'd', kind: 'CALLS', confidence: 1.0 },
        ];

        for (const n of nodes) store = store.addNode(n);
        for (const e of edges) store = store.addEdge(e);

        const pathFinder = findPaths(store);
        const path = pathFinder.shortestPath('a', 'd');

        expect(path).not.toBeNull();
        expect(path!.length).toBe(1);
        expect(path!.edges[0].id).toBe('a->d');
    });
});