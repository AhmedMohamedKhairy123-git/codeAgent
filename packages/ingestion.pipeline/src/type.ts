import type { GraphStore } from '@codeagent/graph-store';
import type { CommunityResult } from '@codeagent/community-detection';
import type { ProcessResult } from '@codeagent/process-detector';

export type PipelinePhase =
    | 'idle'
    | 'scanning'
    | 'structure'
    | 'parsing'
    | 'imports'
    | 'calls'
    | 'heritage'
    | 'communities'
    | 'processes'
    | 'complete'
    | 'error';

export interface PipelineConfig {
    maxFileSize?: number;
    skipBinary?: boolean;
    maxDepth?: number;
    useGitignore?: boolean;
    minConfidence?: number;
    enableCommunities?: boolean;
    enableProcesses?: boolean;
    communityResolution?: number;
    processMaxDepth?: number;
    processMaxBranching?: number;
}

export interface PipelineProgress {
    phase: PipelinePhase;
    percent: number;
    message: string;
    detail?: string;
    stats?: {
        filesProcessed: number;
        totalFiles: number;
        nodesCreated: number;
        edgesCreated: number;
    };
}

export interface PipelineResult {
    graph: GraphStore;
    filePaths: string[];
    communityResult?: CommunityResult;
    processResult?: ProcessResult;
    stats: {
        totalFiles: number;
        totalNodes: number;
        totalEdges: number;
        totalCommunities: number;
        totalProcesses: number;
        duration: number;
    };
}

export type ProgressCallback = (progress: PipelineProgress) => void;