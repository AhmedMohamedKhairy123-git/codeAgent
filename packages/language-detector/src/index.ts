export { LanguageDetector, detectLanguage, getLanguageFromPath, getLanguageFromContent } from './detector.js';
export { LanguageRegistry, registerLanguage, getSupportedLanguages, isLanguageSupported } from './registry.js';
export { ParserConfigManager, getParserConfig, hasParser } from './parser-config.js';
export type { LanguageConfig, ParserConfig, LanguageDetectionResult } from './types.js';