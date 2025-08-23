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
