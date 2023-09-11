export { SymbolExtractor, extractSymbols, extractFromFile } from './extractor.js';
export { ExportDetector, isExported, getExportStatus } from './export-detector.js';
export { PositionTracker, getNodeLocation, getNodeRange, getNodeContext } from './position.js';
export { NodeMatcher, matchPattern, findDefinitions, findCalls } from './matcher.js';
export type { ExtractedSymbol, ExtractionResult, ExtractionOptions, SymbolMetadata } from './types.js';