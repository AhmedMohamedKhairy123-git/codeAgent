import type { PipelineProgress, PipelinePhase, ProgressCallback } from './types.js';

export class PipelineProgressTracker {
    private startTime: number = 0;
    private currentPhase: PipelinePhase = 'idle';
    private currentPercent: number = 0;
    private callbacks: ProgressCallback[] = [];

    constructor() {
        this.startTime = Date.now();
    }

    onProgress(callback: ProgressCallback): void {
        this.callbacks.push(callback);
    }

    update(phase: PipelinePhase, percent: number, message: string, detail?: string, stats?: any): void {
        this.currentPhase = phase;
        this.currentPercent = percent;

        const progress: PipelineProgress = {
            phase,
            percent,
            message,
            detail,
            stats,
        };

        for (const callback of this.callbacks) {
            callback(progress);
        }
    }

    getCurrentPhase(): PipelinePhase {
        return this.currentPhase;
    }

    getCurrentPercent(): number {
        return this.currentPercent;
    }

    getElapsed(): number {
        return (Date.now() - this.startTime) / 1000;
    }

    complete(stats?: any): void {
        this.update('complete', 100, 'Pipeline complete', undefined, stats);
    }

    error(error: string): void {
        this.update('error', this.currentPercent, `Error: ${error}`, undefined, undefined);
    }
}

// Create a progress tracker with default phases
export function createProgressTracker(
    onProgress?: ProgressCallback
): PipelineProgressTracker {
    const tracker = new PipelineProgressTracker();
    if (onProgress) {
        tracker.onProgress(onProgress);
    }
    return tracker;
}