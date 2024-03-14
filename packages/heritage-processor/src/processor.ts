import type { GraphNode } from '@codeagent/core-types';
import { createParser } from '@codeagent/tree-sitter-wrapper';
import { detectLanguage } from '@codeagent/language-detector';
import { extractHeritage } from './extractor.js';
import { InheritanceGraph, buildInheritanceGraph } from './inheritance-graph.js';
import { computeMRO, computeAllMRO } from './mro.js';
import type { HeritageResult, HeritageEdge, HeritageContext } from './types.js';

export class HeritageProcessor {
    private edges: HeritageEdge[] = [];
    private symbols: Map<string, GraphNode> = new Map();
    private imports: Map<string, Set<string>> = new Map();
    private fileIndex: Map<string, string> = new Map();

    addSymbol(node: GraphNode): void {
        this.symbols.set(node.id, node);
    }

    addSymbols(nodes: GraphNode[]): void {
        for (const node of nodes) {
            this.symbols.set(node.id, node);
        }
    }

    addImport(fromFile: string, toFile: string): void {
        if (!this.imports.has(fromFile)) {
            this.imports.set(fromFile, new Set());
        }
        this.imports.get(fromFile)!.add(toFile);
    }

    addFile(filePath: string): void {
        this.fileIndex.set(filePath, filePath);
    }

    async processFile(filePath: string, content: string): Promise<HeritageEdge[]> {
        const language = detectLanguage(filePath, content).language;
        const { tree } = await createParser(language, content, {}, filePath);

        const context: HeritageContext = {
            currentFile: filePath,
            language: language as any,
            symbols: this.symbols,
            imports: this.imports,
            fileIndex: this.fileIndex,
        };

        const edges = extractHeritage(tree.rootNode, context);
        this.edges.push(...edges);
        return edges;
    }

    async processFiles(files: Map<string, string>): Promise<HeritageResult> {
        for (const [filePath, content] of files) {
            await this.processFile(filePath, content);
        }

        return this.getResult();
    }

    getResult(): HeritageResult {
        const extendsCount = this.edges.filter(e => e.kind === 'extends').length;
        const implementsCount = this.edges.filter(e => e.kind === 'implements').length;
        const mixinCount = this.edges.filter(e => e.kind === 'mixin').length;
        const embeddingCount = this.edges.filter(e => e.kind === 'embedding').length;

        return {
            edges: this.edges,
            stats: {
                total: this.edges.length,
                extends: extendsCount,
                implements: implementsCount,
                mixin: mixinCount,
                embedding: embeddingCount,
            },
        };
    }

    getInheritanceGraph(): InheritanceGraph {
        return buildInheritanceGraph(Array.from(this.symbols.values()), this.edges);
    }

    computeMRO(classId: string): ReturnType<typeof computeMRO> {
        const graph = this.getInheritanceGraph();
        return computeMRO(classId, graph);
    }

    computeAllMRO(): Map<string, ReturnType<typeof computeMRO>> {
        const graph = this.getInheritanceGraph();
        return computeAllMRO(graph);
    }
}

// Convenience function
export async function processHeritage(
    files: Map<string, string>,
    symbols: GraphNode[],
    imports: Map<string, Set<string>>
): Promise<HeritageResult> {
    const processor = new HeritageProcessor();

    processor.addSymbols(symbols);

    for (const [fromFile, toFiles] of imports) {
        for (const toFile of toFiles) {
            processor.addImport(fromFile, toFile);
        }
    }

    for (const [filePath, content] of files) {
        processor.addFile(filePath);
        await processor.processFile(filePath, content);
    }

    return processor.getResult();
}