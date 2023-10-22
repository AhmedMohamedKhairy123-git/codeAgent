// Generate stable IDs for nodes
export function generateId(kind: string, identifier: string): string {
    // Sanitize identifier (remove special characters, normalize)
    const sanitized = identifier
        .replace(/[^a-zA-Z0-9_\-:./]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 200);

    return `${kind}:${sanitized}`;
}

// Generate ID for a symbol
export function generateSymbolId(
    kind: string,
    filePath: string,
    name: string,
    line?: number
): string {
    let identifier = `${filePath}:${name}`;
    if (line) {
        identifier += `:${line}`;
    }
    return generateId(kind, identifier);
}

// Generate ID for a relationship
export function generateRelationshipId(
    sourceId: string,
    targetId: string,
    kind: string
): string {
    return `${sourceId}->${targetId}:${kind}`;
}