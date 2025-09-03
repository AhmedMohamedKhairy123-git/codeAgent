import type { GraphStore } from '@codeagent/graph-store';
import type { FileEntry } from '@codeagent/fs-walker';
import type { PipelineProgressTracker, PipelineConfig } from './types.js';

export class StructurePhase {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = filePaths.length;

        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const parts = filePath.split('/');
            let currentPath = '';
            let parentId = '';

            for (let j = 0; j < parts.length; j++) {
                const part = parts[j];
                const isFile = j === parts.length - 1;
                const kind = isFile ? 'File' : 'Folder';
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const nodeId = `${kind}:${currentPath}`;

                if (!currentGraph.getNode(nodeId)) {
                    currentGraph = currentGraph.addNode({
                        id: nodeId,
                        kind: kind as any,
                        name: part,
                        filePath: currentPath,
                        startLine: 0,
                        endLine: 0,
                        language: undefined,
                        isExported: false,
                    });
                }

                if (parentId) {
                    const edgeId = `${parentId}->${nodeId}:CONTAINS`;
                    if (!currentGraph.getEdge(edgeId)) {
                        currentGraph = currentGraph.addEdge({
                            id: edgeId,
                            sourceId: parentId,
                            targetId: nodeId,
                            kind: 'CONTAINS',
                            confidence: 1.0,
                        });
                    }
                }

                parentId = nodeId;
            }

            if ((i + 1) % 100 === 0) {
                tracker.update(
                    'structure',
                    15 + Math.floor((i + 1) / total * 15),
                    `Building structure... ${i + 1}/${total}`,
                    filePath,
                    { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
                );
            }
        }

        tracker.update('structure', 30, 'Structure complete', undefined, {
            filesProcessed: total,
            totalFiles: total,
            nodesCreated: currentGraph.nodeCount,
        });

        return currentGraph;
    }
}

export class ParsingPhase {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = files.length;

        const { extractSymbols } = await import('@codeagent/ast-extractor');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            tracker.update(
                'parsing',
                30 + Math.floor((i + 1) / total * 40),
                `Parsing ${file.path}...`,
                file.path,
                { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
            );

            try {
                const result = await extractSymbols(file.path, file.content);

                for (const symbol of result.symbols) {
                    if (!currentGraph.getNode(symbol.id)) {
                        currentGraph = currentGraph.addNode({
                            id: symbol.id,
                            kind: symbol.kind,
                            name: symbol.name,
                            filePath: symbol.filePath,
                            startLine: symbol.startLine,
                            endLine: symbol.endLine,
                            language: symbol.language,
                            isExported: symbol.isExported,
                        });

                        const fileId = `File:${file.path}`;
                        const edgeId = `${fileId}->${symbol.id}:DEFINES`;
                        if (!currentGraph.getEdge(edgeId)) {
                            currentGraph = currentGraph.addEdge({
                                id: edgeId,
                                sourceId: fileId,
                                targetId: symbol.id,
                                kind: 'DEFINES',
                                confidence: 1.0,
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to parse ${file.path}:`, err);
            }
        }

        tracker.update('parsing', 70, 'Parsing complete', undefined, {
            filesProcessed: total,
            totalFiles: total,
            nodesCreated: currentGraph.nodeCount,
        });

        return currentGraph;
    }
}

export class ImportPhase {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = files.length;

        const { resolveImport } = await import('@codeagent/import-resolver');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            tracker.update(
                'imports',
                70 + Math.floor((i + 1) / total * 12),
                `Resolving imports in ${file.path}...`,
                file.path,
                { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
            );

            try {
                const { findImports } = await import('@codeagent/ast-extractor');
                const { detectLanguage } = await import('@codeagent/language-detector');
                const language = detectLanguage(file.path, file.content).language;
                const { createParser } = await import('@codeagent/tree-sitter-wrapper');
                const { tree } = await createParser(language, file.content, {}, file.path);
                const imports = await findImports(tree, language);

                for (const imp of imports) {
                    const sourceNode = imp['import.source'];
                    if (sourceNode) {
                        let importPath = sourceNode.text.replace(/['"<>]/g, '');
                        const resolved = await resolveImport(importPath, file.path, filePaths, process.cwd());

                        if (resolved.resolved && resolved.resolvedPath) {
                            const sourceId = `File:${file.path}`;
                            const targetId = `File:${resolved.resolvedPath}`;
                            const edgeId = `${sourceId}->${targetId}:IMPORTS`;

                            if (!currentGraph.getEdge(edgeId)) {
                                currentGraph = currentGraph.addEdge({
                                    id: edgeId,
                                    sourceId,
                                    targetId,
                                    kind: 'IMPORTS',
                                    confidence: resolved.confidence,
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to resolve imports for ${file.path}:`, err);
            }
        }

        tracker.update('imports', 82, 'Import resolution complete', undefined, {
            filesProcessed: total,
            totalFiles: total,
            nodesCreated: currentGraph.nodeCount,
        });

        return currentGraph;
    }
}

export class CallGraphPhase {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = files.length;

        const { buildCallGraph } = await import('@codeagent/call-graph');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            tracker.update(
                'calls',
                82 + Math.floor((i + 1) / total * 6),
                `Building call graph for ${file.path}...`,
                file.path,
                { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
            );

            try {
                const { extractCallSites } = await import('@codeagent/call-graph');
                const { detectLanguage } = await import('@codeagent/language-detector');
                const { createParser } = await import('@codeagent/tree-sitter-wrapper');
                const language = detectLanguage(file.path, file.content).language;
                const { tree } = await createParser(language, file.content, {}, file.path);

                const symbolsInFile = Array.from(currentGraph.nodes.values())
                    .filter(n => n.filePath === file.path && (n.kind === 'Function' || n.kind === 'Method'));

                const symbolsMap = new Map(symbolsInFile.map(s => [s.id, s]));

                for (const symbol of symbolsInFile) {
                    const callSites = extractCallSites(tree.rootNode, file.path, symbol.id, file.content);

                    for (const callSite of callSites) {
                        const targetSymbol = symbolsInFile.find(s => s.name === callSite.calledName && s.filePath === file.path);
                        if (targetSymbol) {
                            const edgeId = `${symbol.id}->${targetSymbol.id}:CALLS`;
                            if (!currentGraph.getEdge(edgeId)) {
                                currentGraph = currentGraph.addEdge({
                                    id: edgeId,
                                    sourceId: symbol.id,
                                    targetId: targetSymbol.id,
                                    kind: 'CALLS',
                                    confidence: 0.9,
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to build call graph for ${file.path}:`, err);
            }
        }

        tracker.update('calls', 88, 'Call graph building complete', undefined, {
            filesProcessed: total,
            totalFiles: total,
            nodesCreated: currentGraph.nodeCount,
        });

        return currentGraph;
    }
}

export class HeritagePhase {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = files.length;

        const { processHeritage } = await import('@codeagent/heritage-processor');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            tracker.update(
                'heritage',
                88 + Math.floor((i + 1) / total * 4),
                `Extracting inheritance for ${file.path}...`,
                file.path,
                { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
            );

            try {
                const symbolsMap = new Map(
                    Array.from(currentGraph.nodes.values())
                        .filter(n => n.filePath === file.path)
                        .map(n => [n.id, n])
                );

                const importsMap = new Map<string, Set<string>>();
                const importEdges = Array.from(currentGraph.edges.values())
                    .filter(e => e.kind === 'IMPORTS' && e.sourceId === `File:${file.path}`);

                for (const edge of importEdges) {
                    if (!importsMap.has(edge.sourceId)) {
                        importsMap.set(edge.sourceId, new Set());
                    }
                    importsMap.get(edge.sourceId)!.add(edge.targetId.replace('File:', ''));
                }

                const filesMap = new Map([[file.path, file.content]]);
                const result = await processHeritage(filesMap, Array.from(symbolsMap.values()), importsMap);

                for (const edge of result.edges) {
                    const edgeId = `${edge.sourceId}->${edge.targetId}:${edge.kind.toUpperCase()}`;
                    if (!currentGraph.getEdge(edgeId)) {
                        currentGraph = currentGraph.addEdge({
                            id: edgeId,
                            sourceId: edge.sourceId,
                            targetId: edge.targetId,
                            kind: edge.kind === 'extends' ? 'EXTENDS' : 'IMPLEMENTS',
                            confidence: edge.confidence,
                        });
                    }
                }
            } catch (err) {
                console.warn(`Failed to extract heritage for ${file.path}:`, err);
            }
        }

        tracker.update('heritage', 92, 'Heritage extraction complete', undefined, {
            filesProcessed: total,
            totalFiles: total,
            nodesCreated: currentGraph.nodeCount,
        });

        return currentGraph;
    }
}