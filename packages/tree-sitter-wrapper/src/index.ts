export { ParserManager, createParser, getParser, disposeParser } from './manager.js';
export { QueryCache, compileQuery, getQuery, clearQueryCache } from './query-cache.js';
export { ASTWalker, walkTree, findNodeAtPosition, collectNodes } from './ast-walker.js';
export { LanguageLoader, loadLanguage, isLanguageAvailable } from './language-loader.js';
export type { ParserHandle, ParseOptions, QueryMatch, Capture, NodeInfo } from './types.js';