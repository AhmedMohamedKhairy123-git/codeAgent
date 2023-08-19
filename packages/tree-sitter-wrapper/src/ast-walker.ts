import type Parser from 'tree-sitter';
import type { NodeInfo } from './types.js';

// Walk the AST and collect nodes matching a predicate
export function walkTree(
    node: Parser.SyntaxNode,
    predicate: (node: Parser.SyntaxNode) => boolean,
    results: Parser.SyntaxNode[] = []
): Parser.SyntaxNode[] {
    if (predicate(node)) {
        results.push(node);
    }
    for (const child of node.children) {
        walkTree(child, predicate, results);
    }
    return results;
}

// Find a node at a specific position
export function findNodeAtPosition(
    node: Parser.SyntaxNode,
    row: number,
    column: number
): Parser.SyntaxNode | null {
    if (row < node.startPosition.row || row > node.endPosition.row) {
        return null;
    }
    if (row === node.startPosition.row && column < node.startPosition.column) {
        return null;
    }
    if (row === node.endPosition.row && column > node.endPosition.column) {
        return null;
    }

    for (const child of node.children) {
        const found = findNodeAtPosition(child, row, column);
        if (found) return found;
    }
    return node;
}

// Collect all nodes of a specific type
export function collectNodes(
    node: Parser.SyntaxNode,
    nodeType: string,
    results: Parser.SyntaxNode[] = []
): Parser.SyntaxNode[] {
    if (node.type === nodeType) {
        results.push(node);
    }
    for (const child of node.children) {
        collectNodes(child, nodeType, results);
    }
    return results;
}

// Convert a tree-sitter node to serializable format
export function serializeNode(node: Parser.SyntaxNode): NodeInfo {
    return {
        id: node.id,
        type: node.type,
        text: node.text,
        startPosition: { row: node.startPosition.row, column: node.startPosition.column },
        endPosition: { row: node.endPosition.row, column: node.endPosition.column },
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        isNamed: node.isNamed(),
        hasError: node.hasError(),
        children: node.children.map(serializeNode),
    };
}

// Calculate node depth in tree
export function getNodeDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node.parent;
    while (current) {
        depth++;
        current = current.parent;
    }
    return depth;
}

// Get all ancestor nodes
export function getAncestors(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const ancestors: Parser.SyntaxNode[] = [];
    let current = node.parent;
    while (current) {
        ancestors.push(current);
        current = current.parent;
    }
    return ancestors;
}

// Check if node is a descendant of another node
export function isDescendantOf(
    node: Parser.SyntaxNode,
    ancestor: Parser.SyntaxNode
): boolean {
    let current = node.parent;
    while (current) {
        if (current === ancestor) return true;
        current = current.parent;
    }
    return false;
}

// Get node's field name (if it has one)
export function getFieldName(node: Parser.SyntaxNode): string | null {
    const parent = node.parent;
    if (!parent) return null;

    for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i);
        if (child === node) {
            const fieldName = parent.fieldNameForChild(i);
            if (fieldName) return fieldName;
        }
    }
    return null;
}

// Get the text range of a node
export function getNodeRange(node: Parser.SyntaxNode): { start: number; end: number } {
    return { start: node.startIndex, end: node.endIndex };
}