import type Parser from 'tree-sitter';

// Get node location
export interface NodeLocation {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    startIndex: number;
    endIndex: number;
}

export function getNodeLocation(node: Parser.SyntaxNode): NodeLocation {
    return {
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        startColumn: node.startPosition.column + 1,
        endColumn: node.endPosition.column + 1,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
    };
}

// Get node range as [start, end]
export function getNodeRange(node: Parser.SyntaxNode): [number, number] {
    return [node.startIndex, node.endIndex];
}

// Get context lines around a node
export function getNodeContext(
    content: string,
    node: Parser.SyntaxNode,
    contextLines: number = 2
): { before: string; nodeText: string; after: string } {
    const lines = content.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    const beforeStart = Math.max(0, startLine - contextLines);
    const beforeEnd = startLine;
    const afterStart = endLine + 1;
    const afterEnd = Math.min(lines.length, endLine + contextLines + 1);

    return {
        before: lines.slice(beforeStart, beforeEnd).join('\n'),
        nodeText: lines.slice(startLine, endLine + 1).join('\n'),
        after: lines.slice(afterStart, afterEnd).join('\n'),
    };
}

// Check if a node contains a position
export function containsPosition(
    node: Parser.SyntaxNode,
    line: number,
    column: number
): boolean {
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    const startCol = node.startPosition.column;
    const endCol = node.endPosition.column;

    if (line < startLine || line > endLine) return false;
    if (line === startLine && column < startCol) return false;
    if (line === endLine && column > endCol) return false;
    return true;
}

// Get the smallest node containing a position
export function findContainingNode(
    root: Parser.SyntaxNode,
    line: number,
    column: number
): Parser.SyntaxNode | null {
    if (!containsPosition(root, line, column)) return null;

    for (const child of root.children) {
        const found = findContainingNode(child, line, column);
        if (found) return found;
    }
    return root;
}