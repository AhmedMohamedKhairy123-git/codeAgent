import { createGraphStore, type GraphStore } from '@codeagent/graph-store';
import { walkDirectory, type FileEntry } from '@codeagent/fs-walker';
import { createProgressTracker } from './progress.js';
import { StructurePhase, ParsingPhase, ImportPhase, CallGraphPhase, HeritagePhase } from './phases.js';
import type { PipelineConfig, PipelineResult, ProgressCallback } from './types.js';

const DEFAULT_CONFIG: Required<PipelineConfig> = {
    maxFileSize: 1024 * 1024,
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

    async runOnDirectory(rootPath: string): Promise<PipelineResult> {
        const startTime = Date.now();

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

        const phases = [
            new StructurePhase(),
            new ParsingPhase(),
            new ImportPhase(),
            new CallGraphPhase(),
            new HeritagePhase(),
        ];

        for (const phase of phases) {
            this.graph = await phase.run(
                this.graph,
                files,
                filePaths,
                this.tracker,
                this.config
            );
        }

        let communityResult = undefined;
        if (this.config.enableCommunities) {
            this.tracker.update('communities', 94, 'Detecting communities...', undefined);
            const { detectCommunities } = await import('@codeagent/community-detection');
            communityResult = await detectCommunities(this.graph, {
                resolution: this.config.communityResolution,
            });

            for (const community of communityResult.communities) {
                const communityNode = {
                    id: community.id,
                    kind: 'Community' as const,
                    name: community.label,
                    filePath: '',
                    startLine: 0,
                    endLine: 0,
                    language: undefined,
                    isExported: false,
                };
                this.graph = this.graph.addNode(communityNode);

                for (const memberId of community.members) {
                    const edgeId = `${memberId}->${community.id}:MEMBER_OF`;
                    if (!this.graph.getEdge(edgeId)) {
                        this.graph = this.graph.addEdge({
                            id: edgeId,
                            sourceId: memberId,
                            targetId: community.id,
                            kind: 'MEMBER_OF',
                            confidence: 1.0,
                        });
                    }
                }
            }
        }

        let processResult = undefined;
        if (this.config.enableProcesses) {
            this.tracker.update('processes', 98, 'Detecting execution flows...', undefined);
            const { detectProcesses } = await import('@codeagent/process-detector');
            processResult = await detectProcesses(this.graph, {
                maxTraceDepth: this.config.processMaxDepth,
                maxBranching: this.config.processMaxBranching,
            });

            for (const process of processResult.processes) {
                const processNode = {
                    id: process.id,
                    kind: 'Process' as const,
                    name: process.label,
                    filePath: '',
                    startLine: 0,
                    endLine: 0,
                    language: undefined,
                    isExported: false,
                };
                this.graph = this.graph.addNode(processNode);

                for (const step of processResult.steps.filter(s => s.processId === process.id)) {
                    const edgeId = `${step.nodeId}->${step.processId}:STEP_IN_PROCESS`;
