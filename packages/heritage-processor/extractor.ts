import type { SyntaxNode } from 'tree-sitter';
import type { HeritageEdge, HeritageContext } from './types.js';

// Extract heritage relationships from AST node
export function extractHeritage(
    node: SyntaxNode,
    context: HeritageContext
): HeritageEdge[] {
    const edges: HeritageEdge[] = [];

    // Find class/interface declarations
    if (isClassDeclaration(node)) {
        const edgesFromClass = extractFromClass(node, context);
        edges.push(...edgesFromClass);
    }

    if (isInterfaceDeclaration(node)) {
        const edgesFromInterface = extractFromInterface(node, context);
        edges.push(...edgesFromInterface);
    }

    // Recursively traverse children
    for (const child of node.children) {
        const childEdges = extractHeritage(child, context);
        edges.push(...childEdges);
    }

    return edges;
}

// Check if node is a class declaration
function isClassDeclaration(node: SyntaxNode): boolean {
    const classTypes = [
        'class_declaration',
        'class_definition',
        'class_specifier',
    ];
    return classTypes.includes(node.type);
}

// Check if node is an interface declaration
function isInterfaceDeclaration(node: SyntaxNode): boolean {
    const interfaceTypes = [
        'interface_declaration',
        'trait_declaration',
        'protocol_declaration',
    ];
    return interfaceTypes.includes(node.type);
}

// Extract extends/implements from class
function extractFromClass(node: SyntaxNode, context: HeritageContext): HeritageEdge[] {
    const edges: HeritageEdge[] = [];

    const className = extractClassName(node);
    if (!className) return edges;

    const sourceId = findSymbolId(className, context.currentFile, context);
    if (!sourceId) return edges;

    // Find extends clause
    const extendsNode = findExtendsClause(node);
    if (extendsNode) {
        const parentNames = extractParentNames(extendsNode);
        for (const parentName of parentNames) {
            const targetId = resolveParentSymbol(parentName, context);
            if (targetId) {
                edges.push({
                    sourceId,
                    targetId,
                    kind: 'extends',
                    confidence: 1.0,
                    sourceFile: context.currentFile,
                    targetFile: context.symbols.get(targetId)?.filePath || context.currentFile,
                });
            }
        }
    }

    // Find implements clause
    const implementsNode = findImplementsClause(node);
    if (implementsNode) {
        const interfaceNames = extractParentNames(implementsNode);
        for (const interfaceName of interfaceNames) {
            const targetId = resolveParentSymbol(interfaceName, context);
            if (targetId) {
                edges.push({
                    sourceId,
                    targetId,
                    kind: 'implements',
                    confidence: 0.95,
                    sourceFile: context.currentFile,
                    targetFile: context.symbols.get(targetId)?.filePath || context.currentFile,
                });
            }
        }
    }

    return edges;
}

// Extract from interface (extends other interfaces)
function extractFromInterface(node: SyntaxNode, context: HeritageContext): HeritageEdge[] {
    const edges: HeritageEdge[] = [];

    const interfaceName = extractClassName(node);
    if (!interfaceName) return edges;

    const sourceId = findSymbolId(interfaceName, context.currentFile, context);
    if (!sourceId) return edges;

    // Find extends clause for interfaces
    const extendsNode = findExtendsClause(node);
    if (extendsNode) {
        const parentNames = extractParentNames(extendsNode);
        for (const parentName of parentNames) {
            const targetId = resolveParentSymbol(parentName, context);
            if (targetId) {
                edges.push({
                    sourceId,
                    targetId,
                    kind: 'extends',
                    confidence: 0.95,
                    sourceFile: context.currentFile,
                    targetFile: context.symbols.get(targetId)?.filePath || context.currentFile,
                });
            }
        }
    }

    return edges;
}

// Extract class name from declaration node
function extractClassName(node: SyntaxNode): string | null {
    // Try name field first
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
        return nameNode.text;
    }

    // Try to find identifier children
    for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'type_identifier') {
            return child.text;
        }
    }

    return null;
}

// Find extends clause in node
function findExtendsClause(node: SyntaxNode): SyntaxNode | null {
    // Check for class_heritage (TypeScript/JavaScript)
    for (const child of node.children) {
        if (child.type === 'class_heritage') {
            for (const grandchild of child.children) {
                if (grandchild.type === 'extends_clause') {
                    return grandchild;
                }
            }
        }
        // Check for base_clause (PHP, C#)
        if (child.type === 'base_clause' || child.type === 'base_list') {
            return child;
        }
        // Check for superclass (Java, Python)
        if (child.type === 'superclass') {
            return child;
        }
    }
    return null;
}

// Find implements clause in node
function findImplementsClause(node: SyntaxNode): SyntaxNode | null {
    for (const child of node.children) {
        if (child.type === 'implements_clause') {
            return child;
        }
        if (child.type === 'class_interface_clause') {
            return child;
        }
        if (child.type === 'super_interfaces') {
            return child;
        }
    }
    return null;
}

// Extract parent names from heritage clause
function extractParentNames(clauseNode: SyntaxNode): string[] {
    const names: string[] = [];

    for (const child of clauseNode.children) {
        // Direct type identifier
        if (child.type === 'type_identifier' || child.type === 'identifier') {
            names.push(child.text);
        }
        // Generic type with name
        if (child.type === 'generic_type') {
            const nameNode = child.childForFieldName('name');
            if (nameNode) {
                names.push(nameNode.text);
            }
        }
        // Qualified name
        if (child.type === 'qualified_name') {
            const parts = child.text.split('.');
            names.push(parts[parts.length - 1]);
        }
    }

    return names;
}

// Find symbol ID for a class/interface
function findSymbolId(
    name: string,
    currentFile: string,
    context: HeritageContext
): string | null {
    // Search in current file first
    for (const [id, node] of context.symbols) {
        if (node.name === name && node.filePath === currentFile) {
            return id;
        }
    }

    // Search in imported files
    const imports = context.imports.get(currentFile);
    if (imports) {
        for (const importedFile of imports) {
            for (const [id, node] of context.symbols) {
                if (node.name === name && node.filePath === importedFile) {
                    return id;
                }
            }
        }
    }

    // Global search
    for (const [id, node] of context.symbols) {
        if (node.name === name) {
            return id;
        }
    }

    return null;
}

// Resolve parent symbol (with package/namespace handling)
function resolveParentSymbol(parentName: string, context: HeritageContext): string | null {
    // Try direct lookup first
    const direct = findSymbolId(parentName, context.currentFile, context);
    if (direct) return direct;

    // Check if parent name is qualified
    if (parentName.includes('.')) {
        const parts = parentName.split('.');
        const simpleName = parts[parts.length - 1];
        return findSymbolId(simpleName, context.currentFile, context);
    }

    return null;
}