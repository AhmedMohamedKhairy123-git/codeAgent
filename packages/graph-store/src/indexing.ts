import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import { GraphStore } from './graph-store.js';

export interface GraphIndex {
    byName: Map<string, GraphNode[]>;
    byKind: Map<string, GraphNode[]>;
    byFile: Map<string, GraphNode[]>;
    byLanguage: Map<string, GraphNode[]>;
    byExported: Map<boolean, GraphNode[]>;
    outgoingEdges: Map<string, GraphEdge[]>;
    incomingEdges: Map<string, GraphEdge[]>;
}

export class GraphIndexer {
    private store: GraphStore;
    private index: GraphIndex;

    constructor(store: GraphStore) {
        this.store = store;
        this.index = this.buildIndex(store);
    }

    private buildIndex(store: GraphStore): GraphIndex {
        const byName = new Map<string, GraphNode[]>();
        const byKind = new Map<string, GraphNode[]>();
        const byFile = new Map<string, GraphNode[]>();
        const byLanguage = new Map<string, GraphNode[]>();
        const byExported = new Map<boolean, GraphNode[]>();
        const outgoingEdges = new Map<string, GraphEdge[]>();
        const incomingEdges = new Map<string, GraphEdge[]>();

        for (const [id, node] of store.nodes) {
            this.addToMap(byName, node.name, node);
            this.addToMap(byKind, node.kind, node);
            this.addToMap(byFile, node.filePath, node);
            if (node.language) {
                this.addToMap(byLanguage, node.language, node);
            }
            this.addToMap(byExported, node.isExported || false, node);
        }

        for (const [id, edge] of store.edges) {
            this.addToEdgeMap(outgoingEdges, edge.sourceId, edge);
            this.addToEdgeMap(incomingEdges, edge.targetId, edge);
        }

        return { byName, byKind, byFile, byLanguage, byExported, outgoingEdges, incomingEdges };
    }

    private addToMap(map: Map<string, GraphNode[]>, key: string, node: GraphNode): void {
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(node);
    }

    private addToEdgeMap(map: Map<string, GraphEdge[]>, key: string, edge: GraphEdge): void {
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(edge);
    }

    findByName(name: string, exact: boolean = true): GraphNode[] {
        if (exact) {
            return this.index.byName.get(name) || [];
        }

        const results: GraphNode[] = [];
        for (const [nodeName, nodes] of this.index.byName) {
            if (nodeName.toLowerCase().includes(name.toLowerCase())) {
                results.push(...nodes);
            }
        }
        return results;
    }

    findByKind(kind: string): GraphNode[] {
        return this.index.byKind.get(kind) || [];
    }

    findByFile(filePattern: string | RegExp): GraphNode[] {
        const results: GraphNode[] = [];

        if (typeof filePattern === 'string') {
            for (const [filePath, nodes] of this.index.byFile) {
                if (filePath.includes(filePattern)) {
                    results.push(...nodes);
                }
            }
        } else {
            for (const [filePath, nodes] of this.index.byFile) {
                if (filePattern.test(filePath)) {
                    results.push(...nodes);
                }
            }
        }

        return results;
    }

    findByLanguage(language: string): GraphNode[] {
        return this.index.byLanguage.get(language) || [];
    }

    findByExported(exported: boolean): GraphNode[] {
        return this.index.byExported.get(exported) || [];
    }

    getOutgoing(nodeId: string): GraphEdge[] {
        return this.index.outgoingEdges.get(nodeId) || [];
    }

    getIncoming(nodeId: string): GraphEdge[] {
        return this.index.incomingEdges.get(nodeId) || [];
    }

    search(query: {
        name?: string;
        kind?: string;
        file?: string | RegExp;
        language?: string;
        exported?: boolean;
        fuzzy?: boolean;
    }): GraphNode[] {
        let results: GraphNode[] | null = null;

        if (query.name) {
            results = this.findByName(query.name, !query.fuzzy);
        }

        if (query.kind) {
            const byKind = this.findByKind(query.kind);
            results = results ? this.intersect(results, byKind) : byKind;
        }

        if (query.file) {
            const byFile = this.findByFile(query.file);
            results = results ? this.intersect(results, byFile) : byFile;
        }

        if (query.language) {
            const byLanguage = this.findByLanguage(query.language);
            results = results ? this.intersect(results, byLanguage) : byLanguage;
        }

        if (query.exported !== undefined) {
            const byExported = this.findByExported(query.exported);
            results = results ? this.intersect(results, byExported) : byExported;
        }

        return results || [];
    }

    private intersect(a: GraphNode[], b: GraphNode[]): GraphNode[] {
        const bSet = new Set(b.map(n => n.id));
        return a.filter(n => bSet.has(n.id));
    }

    refresh(): void {
        this.index = this.buildIndex(this.store);
    }
}

export function createIndexer(store: GraphStore): GraphIndexer {
    return new GraphIndexer(store);
}