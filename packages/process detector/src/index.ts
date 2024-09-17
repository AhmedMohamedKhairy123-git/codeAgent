export { ProcessDetector, detectProcesses } from './detector.js';
export { EntryPointScorer, scoreEntryPoint, isTestFile } from './entry-point-scorer.js';
export { TraceBuilder, buildTrace, BFSWalker } from './trace-builder.js';
export { ProcessLabeler, generateProcessLabel } from './process-labeler.js';
export type { Process, ProcessStep, ProcessResult, TraceNode, ProcessConfig } from './types.js';