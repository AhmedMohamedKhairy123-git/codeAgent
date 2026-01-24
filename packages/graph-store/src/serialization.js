import fs from 'fs/promises';
import path from 'path';
import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import { GraphStore } from './graph-store.js';

export interface SerializedGraph {
    version: string;
    createdAt: string;
    updatedAt: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata: {
        nodeCount: number;
        edgeCount: number;
        languages: string[];
        nodeKinds: Record<string, number>;
        relationKinds: Record<string, number>;
    };
}

export interface GraphMetadata {
    nodeCount: number;
    edgeCount: number;
    languages: string[];
    nodeKinds: Record<string, number>;
    relationKinds: Record<string, number>;
}

export class GraphSerializer {
    private static VERSION = '1.0.0';

    static serialize(store: GraphStore, metadata?: Partial<GraphMetadata>): SerializedGraph {
        const nodes = Array.from(store.nodes.values());
        const edges = Array.from(store.edges.values());

        const languages = new Set < string > ();
        const nodeKinds: Record<string, number> = {};
        const relationKinds: Record<string, number> = {};

        for (const node of nodes) {
            if (node.language) languages.add(node.language);
            nodeKinds[node.kind] = (nodeKinds[node.kind] || 0) + 1;
        }

        for (const edge of edges) {
            relationKinds[edge.kind] = (relationKinds[edge.kind] || 0) + 1;
        }

        return {
            version: this.VERSION,
            createdAt: metadata?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            nodes,
            edges,
            metadata: {
                nodeCount: nodes.length,
                edgeCount: edges.length,
                languages: Array.from(languages),
                nodeKinds,
                relationKinds,
                ...metadata,
            },
        };
    }

    static deserialize(data: SerializedGraph): GraphStore {
        let store = new GraphStore();

        for (const node of data.nodes) {
            store = store.addNode(node);
        }

        for (const edge of data.edges) {
            store = store.addEdge(edge);
        }

        return store;
    }

    static async saveToFile(store: GraphStore, filePath: string, metadata?: Partial<GraphMetadata>): Promise<void> {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        const serialized = this.serialize(store, metadata);
        await fs.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
    }

    static async loadFromFile(filePath: string): Promise<GraphStore> {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as SerializedGraph;

        if (data.version !== this.VERSION) {
            console.warn(`Graph version mismatch: expected ${this.VERSION}, got ${data.version}`);
        }

        return this.deserialize(data);
    }

    static async loadFromFileSafe(filePath: string): Promise<GraphStore | null> {
        try {
            return await this.loadFromFile(filePath);
        } catch {
            return null;
        }
    }
}

export async function saveGraph(store: GraphStore, filePath: string, metadata?: Partial<GraphMetadata>): Promise<void> {
    return GraphSerializer.saveToFile(store, filePath, metadata);
}

export async function loadGraph(filePath: string): Promise<GraphStore> {
    return GraphSerializer.loadFromFile(filePath);
}

export async function loadGraphSafe(filePath: string): Promise<GraphStore | null> {
    return GraphSerializer.loadFromFileSafe(filePath);
}