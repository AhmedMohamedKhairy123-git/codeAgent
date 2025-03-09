import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphStore } from '@codeagent/graph-store';
import { ToolRegistry, registerAllTools } from './tools/index.js';
import { ResourceRegistry, registerAllResources } from './resources/index.js';
import type { ToolContext } from './types.js';

describe('MCPServer', () => {
    let context: ToolContext;
    let toolRegistry: ToolRegistry;
    let resourceRegistry: ResourceRegistry;

    beforeEach(() => {
        const graph = createGraphStore();

        // Add test nodes
        graph = graph.addNode({
            id: 'Function:main',
            kind: 'Function',
            name: 'main',
            filePath: 'src/main.ts',
            startLine: 1,
            endLine: 10,
            language: 'typescript',
            isExported: true,
        });

        graph = graph.addNode({
            id: 'Function:greet',
            kind: 'Function',
            name: 'greet',
            filePath: 'src/greet.ts',
            startLine: 1,
            endLine: 5,
            language: 'typescript',
            isExported: true,
        });

        graph = graph.addNode({
            id: 'Function:save',
            kind: 'Function',
            name: 'save',
            filePath: 'src/save.ts',
            startLine: 1,
            endLine: 8,
            language: 'typescript',
            isExported: false,
        });

        // Add edges
        graph = graph.addEdge({
            id: 'main->greet',
            sourceId: 'Function:main',
            targetId: 'Function:greet',
            kind: 'CALLS',
            confidence: 1.0,
        });

        graph = graph.addEdge({
            id: 'greet->save',
            sourceId: 'Function:greet',
            targetId: 'Function:save',
            kind: 'CALLS',
            confidence: 1.0,
        });

        context = {
            graph,
            repoPath: '/test/repo',
        };

        toolRegistry = new ToolRegistry(context);
        resourceRegistry = new ResourceRegistry(context);
    });

    describe('ToolRegistry', () => {
        it('registers tools', () => {
            registerAllTools(toolRegistry);
            const tools = toolRegistry.list();
            expect(tools.length).toBeGreaterThan(0);
            expect(tools.some(t => t.name === 'query')).toBe(true);
            expect(tools.some(t => t.name === 'context')).toBe(true);
            expect(tools.some(t => t.name === 'impact')).toBe(true);
        });

        it('calls query tool', async () => {
            registerAllTools(toolRegistry);
            const result = await toolRegistry.call('query', { query: 'main' });
            expect(result.results).toBeDefined();
            expect(result.results.length).toBeGreaterThan(0);
        });

        it('calls context tool', async () => {
            registerAllTools(toolRegistry);
            const result = await toolRegistry.call('context', { name: 'greet' });
            expect(result.symbol).toBeDefined();
            expect(result.symbol.name).toBe('greet');
        });

        it('calls impact tool', async () => {
            registerAllTools(toolRegistry);
            const result = await toolRegistry.call('impact', { target: 'greet', direction: 'upstream' });
            expect(result.impactedCount).toBeGreaterThan(0);
            expect(result.byDepth[1]).toBeDefined();
        });

        it('throws error for unknown tool', async () => {
            registerAllTools(toolRegistry);
            await expect(toolRegistry.call('unknown', {})).rejects.toThrow('Unknown tool');
        });
    });

    describe('ResourceRegistry', () => {
        it('registers resources', () => {
            registerAllResources(resourceRegistry);
            const resources = resourceRegistry.list();
            expect(resources.length).toBeGreaterThan(0);
        });

        it('reads repos resource', async () => {
            registerAllResources(resourceRegistry);
            const content = await resourceRegistry.read('codeagent://repos');
            expect(content).toContain('repos:');
            expect(content).toContain('/test/repo');
        });

        it('reads context resource', async () => {
            registerAllResources(resourceRegistry);
            const content = await resourceRegistry.read('codeagent://repo/context');
            expect(content).toContain('project: repo');
            expect(content).toContain('functions: 2');
        });
    });
});