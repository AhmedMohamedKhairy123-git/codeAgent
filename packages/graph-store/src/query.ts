import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import { GraphStore } from './graph-store.js';
import type { NodeFilter, EdgeFilter } from './types.js';

// Query builder for fluent graph queries
export class QueryBuilder {
    private store: GraphStore;
    private nodeFilter: NodeFilter = {};
    private edgeFilter: EdgeFilter = {};

    constructor(store: GraphStore) {
        this.store = store;
    }

    // Node filters
    whereKind(kind: string | string[]): this {
        this.nodeFilter.kind = kind;
        return this;
    }

    whereFile(pattern: string | RegExp): this {
        this.nodeFilter.filePath = pattern;
        return this;
    }

    whereName(pattern: string | RegExp): this {
        this.nodeFilter.name = pattern;
        return this;
    }

    whereExported(exported: boolean): this {
        this.nodeFilter.isExported = exported;
        return this;
    }

    whereLanguage(lang: string): this {
        this.nodeFilter.language = lang;
        return this;
    }

    // Edge filters
    withRelation(kind: string | string[]): this {
        this.edgeFilter.kind = kind;
        return this;
    }

    withConfidence(min: number): this {
        this.edgeFilter.minConfidence = min;
        return this;
    }

    // Execute
    findNodes(): GraphNode[] {
        return this.store.findNodes(this.nodeFilter);
    }

    findEdges(): GraphEdge[] {
        return this.store.findEdges(this.edgeFilter);
    }

    findConnected(startId: string, depth: number = 1): GraphNode[] {
        const visited = new Set<string>();
        const result: GraphNode[] = [];
        let frontier = [startId];

        for (let d = 0; d < depth && frontier.length > 0; d++) {
            const next: string[] = [];
            for (const id of frontier) {
                if (visited.has(id)) continue;
                visited.add(id);
                const node = this.store.getNode(id);
                if (node) result.push(node);
                const neighbors = this.store.getNeighbors(id);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.id)) {
                        next.push(neighbor.id);
                    }
                }
            }
            frontier = next;
        }

        return result;
    }
}

// Helper to start a query
export function query(store: GraphStore): QueryBuilder {
    return new QueryBuilder(store);
}