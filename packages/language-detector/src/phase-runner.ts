import type { GraphStore } from '@codeagent/graph-store';
import type { FileEntry } from '@codeagent/fs-walker';
import type { PipelineProgressTracker } from './progress.js';
import type { PipelineConfig } from './types.js';

// Phase runner interface
export interface PhaseRunner {
    run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore>;
}

// Structure phase - build folder/file hierarchy
export class StructurePhase implements PhaseRunner {
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

                // Check if node already exists
                if (!currentGraph.getNode(nodeId)) {
                    const node = {
                        id: nodeId,
                        kind: kind as any,
                        name: part,
                        filePath: currentPath,
                        startLine: 0,
                        endLine: 0,
                        language: undefined,
                        isExported: false,
                    };
                    currentGraph = currentGraph.addNode(node);
                }

                if (parentId) {
                    const edgeId = `${parentId}->${nodeId}:CONTAINS`;
                    if (!currentGraph.getEdge(edgeId)) {
                        const edge = {
                            id: edgeId,
                            sourceId: parentId,
                            targetId: nodeId,
                            kind: 'CONTAINS',
                            confidence: 1.0,
                        };
                        currentGraph = currentGraph.addEdge(edge);
                    }
                }

                parentId = nodeId;
            }

            if ((i + 1) % 100 === 0) {
                const percent = 15 + Math.floor((i + 1) / total * 15);
                tracker.update(
                    'structure',
                    percent,
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

// Parsing phase - extract symbols from files
export class ParsingPhase implements PhaseRunner {
    async run(
        graph: GraphStore,
        files: FileEntry[],
        filePaths: string[],
        tracker: PipelineProgressTracker,
        config: PipelineConfig
    ): Promise<GraphStore> {
        let currentGraph = graph;
        const total = files.length;

        // Import extractor dynamically to avoid circular deps
        const { extractSymbols } = await import('@codeagent/ast-extractor');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const percent = 30 + Math.floor((i + 1) / total * 40);
            tracker.update(
                'parsing',
                percent,
                `Parsing ${file.path}...`,
                file.path,
                { filesProcessed: i + 1, totalFiles: total, nodesCreated: currentGraph.nodeCount }
            );

            try {
                const result = await extractSymbols(file.path, file.content);

                // Add symbols to graph
                for (const symbol of result.symbols) {
                    if (!currentGraph.getNode(symbol.id)) {
                        const node = {
                            id: symbol.id,
                            kind: symbol.kind,
                            name: symbol.name,
                            filePath: symbol.filePath,
                            startLine: symbol.startLine,
                            endLine: symbol.endLine,
                            language: symbol.language,
                            isExported: symbol.isExported,
                        };
                        currentGraph = currentGraph.addNode(node);

                        // Add DEFINES edge from file to symbol
                        const fileId = `File:${file.path}`;
                        const edgeId = `${fileId}->${symbol.id}:DEFINES`;
                        if (!currentGraph.getEdge(edgeId)) {
                            const edge = {
                                id: edgeId,
                                sourceId: fileId,
                                targetId: symbol.id,
                                kind: 'DEFINES',
                                confidence: 1.0,
                            };
                            currentGraph = currentGraph.addEdge(edge);
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

// Create all phase runners
export function createPhaseRunner(): PhaseRunner[] {
    return [
        new StructurePhase(),
        new ParsingPhase(),
    ];
}