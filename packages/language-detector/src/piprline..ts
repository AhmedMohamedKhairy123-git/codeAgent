import { createGraphStore, type GraphStore } from '@codeagent/graph-store';
import { walkDirectory, type FileEntry } from '@codeagent/fs-walker';
import { detectLanguage } from '@codeagent/language-detector';
import { createProgressTracker } from './progress.js';
import { createPhaseRunner } from './phase-runner.js';
import type { PipelineConfig, PipelineResult, ProgressCallback } from './types.js';

// Default configuration
const DEFAULT_CONFIG: Required<PipelineConfig> = {
    maxFileSize: 1024 * 1024, // 1MB
    skipBinary: true,
    maxDepth: Infinity,
    useGitignore: true,
    minConfidence: 0.5,
    enableCommunities: true,
    enableProcesses: true,
    communityResolution: 1.0,
    processMaxDepth: 10,
    processMaxBranching: 4,
};

export class IngestionPipeline {
    private config: Required<PipelineConfig>;
    private graph: GraphStore;
    private tracker: ReturnType<typeof createProgressTracker>;

    constructor(config: PipelineConfig = {}, onProgress?: ProgressCallback) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.graph = createGraphStore();
        this.tracker = createProgressTracker(onProgress);
    }

    // Run pipeline on a directory
    async runOnDirectory(rootPath: string): Promise<PipelineResult> {
        const startTime = Date.now();

        // Phase 1: Scan files
        this.tracker.update('scanning', 0, 'Scanning directory...', rootPath);

        const walkResult = await walkDirectory(rootPath, {
            maxFileSize: this.config.maxFileSize,
            skipBinary: this.config.skipBinary,
            maxDepth: this.config.maxDepth,
            useGitignore: this.config.useGitignore,
            readContent: true,
        });

        const files = walkResult.files;
        const filePaths = files.map(f => f.path);

        this.tracker.update('scanning', 15, `Found ${files.length} files`, undefined, {
            filesProcessed: files.length,
            totalFiles: files.length,
            nodesCreated: 0,
        });

        // Run phases
        const phases = createPhaseRunner();

        for (const phase of phases) {
            this.graph = await phase.run(
                this.graph,
                files,
                filePaths,
                this.tracker,
                this.config
            );
        }

        // Phase: Import resolution (simplified - would need full implementation)
        this.tracker.update('imports', 82, 'Resolving imports...', undefined);
        await this.resolveImports(files);

        // Phase: Call graph
        this.tracker.update('calls', 88, 'Building call graph...', undefined);
        await this.buildCallGraph(files);

        // Phase: Heritage
        this.tracker.update('heritage', 92, 'Extracting inheritance...', undefined);
        await this.extractHeritage(files);

        // Phase: Communities (optional)
        let communityResult = undefined;
        if (this.config.enableCommunities) {
            this.tracker.update('communities', 94, 'Detecting communities...', undefined);
            const { detectCommunities } = await import('@codeagent/community-detection');
            communityResult = await detectCommunities(this.graph, {
                resolution: this.config.communityResolution,
            });

            // Add community nodes to graph
            for (const community of communityResult.communities) {
                const communityNode = {
                    id: community.id,
                    kind: 'Community' as any,
                    name: community.label,
                    filePath: '',
                    startLine: 0,
                    endLine: 0,
                    language: undefined,
                    isExported: false,
                };
                this.graph = this.graph.addNode(communityNode);

                // Add MEMBER_OF edges
                for (const memberId of community.members) {
                    const edgeId = `${memberId}->${community.id}:MEMBER_OF`;
                    if (!this.graph.getEdge(edgeId)) {
                        const edge = {
                            id: edgeId,
                            sourceId: memberId,
                            targetId: community.id,
                            kind: 'MEMBER_OF',
                            confidence: 1.0,
                        };
                        this.graph = this.graph.addEdge(edge);
                    }
                }
            }
        }

        // Phase: Processes (optional)
        let processResult = undefined;
        if (this.config.enableProcesses) {
            this.tracker.update('processes', 98, 'Detecting execution flows...', undefined);
            const { detectProcesses } = await import('@codeagent/process-detector');
            processResult = await detectProcesses(this.graph, {
                maxTraceDepth: this.config.processMaxDepth,
                maxBranching: this.config.processMaxBranching,
            });

            // Add process nodes to graph
            for (const process of processResult.processes) {
                const processNode = {
                    id: process.id,
                    kind: 'Process' as any,
                    name: process.label,
                    filePath: '',
                    startLine: 0,
                    endLine: 0,
                    language: undefined,
                    isExported: false,
                };
                this.graph = this.graph.addNode(processNode);

                // Add STEP_IN_PROCESS edges
                for (const step of processResult.steps.filter(s => s.processId === process.id)) {
                    const edgeId = `${step.nodeId}->${step.processId}:STEP_IN_PROCESS`;
                    if (!this.graph.getEdge(edgeId)) {
                        const edge = {
                            id: edgeId,
                            sourceId: step.nodeId,
                            targetId: step.processId,
                            kind: 'STEP_IN_PROCESS',
                            confidence: 1.0,
                            step: step.step,
                        };
                        this.graph = this.graph.addEdge(edge);
                    }
                }
            }
        }

        const duration = (Date.now() - startTime) / 1000;

        this.tracker.complete({
            filesProcessed: files.length,
            totalFiles: files.length,
            nodesCreated: this.graph.nodeCount,
            edgesCreated: this.graph.edgeCount,
        });

        return {
            graph: this.graph,
            filePaths,
            communityResult,
            processResult,
            stats: {
                totalFiles: files.length,
                totalNodes: this.graph.nodeCount,
                totalEdges: this.graph.edgeCount,
                totalCommunities: communityResult?.communities.length || 0,
                totalProcesses: processResult?.processes.length || 0,
                duration,
            },
        };
    }

    // Run pipeline on file list (from ZIP or clone)
    async runOnFiles(files: FileEntry[], rootPath: string = ''): Promise<PipelineResult> {
        const startTime = Date.now();

        this.tracker.update('scanning', 0, `Processing ${files.length} files...`, undefined);
        this.tracker.update('scanning', 15, `Found ${files.length} files`, undefined, {
            filesProcessed: files.length,
            totalFiles: files.length,
            nodesCreated: 0,
        });

        const filePaths = files.map(f => f.path);

        // Run phases
        const phases = createPhaseRunner();

        for (const phase of phases) {
            this.graph = await phase.run(
                this.graph,
                files,
                filePaths,
                this.tracker,
                this.config
            );
        }

        // Simplified import/call/heritage for file-based input
        this.tracker.update('imports', 82, 'Resolving imports...', undefined);
        this.tracker.update('calls', 88, 'Building call graph...', undefined);
        this.tracker.update('heritage', 92, 'Extracting inheritance...', undefined);

        // Communities and processes (optional)
        let communityResult = undefined;
        let processResult = undefined;

        const duration = (Date.now() - startTime) / 1000;

        this.tracker.complete({
            filesProcessed: files.length,
            totalFiles: files.length,
            nodesCreated: this.graph.nodeCount,
            edgesCreated: this.graph.edgeCount,
        });

        return {
            graph: this.graph,
            filePaths,
            communityResult,
            processResult,
            stats: {
                totalFiles: files.length,
                totalNodes: this.graph.nodeCount,
                totalEdges: this.graph.edgeCount,
                totalCommunities: 0,
                totalProcesses: 0,
                duration,
            },
        };
    }

    // Stub methods for full pipeline (to be implemented in later phases)
    private async resolveImports(files: FileEntry[]): Promise<void> {
        // Import resolution logic - Phase 14
    }

    private async buildCallGraph(files: FileEntry[]): Promise<void> {
        // Call graph building - Phase 15
    }

    private async extractHeritage(files: FileEntry[]): Promise<void> {
        // Heritage extraction - Phase 16
    }
}

// Convenience functions
export async function runPipeline(
    rootPath: string,
    onProgress?: ProgressCallback,
    config?: PipelineConfig
): Promise<PipelineResult> {
    const pipeline = new IngestionPipeline(config, onProgress);
    return pipeline.runOnDirectory(rootPath);
}

export async function runPipelineFromFiles(
    files: FileEntry[],
    onProgress?: ProgressCallback,
    config?: PipelineConfig
): Promise<PipelineResult> {
    const pipeline = new IngestionPipeline(config, onProgress);
    return pipeline.runOnFiles(files);
}