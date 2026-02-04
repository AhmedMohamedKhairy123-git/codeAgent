import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import type { GraphSnapshot, GraphDiff, NodeFilter, EdgeFilter } from './types.js';

// Immutable graph store with functional updates
export class GraphStore {
    private readonly snapshot: GraphSnapshot;

    constructor(initialSnapshot?: GraphSnapshot) {
        this.snapshot = initialSnapshot ?? {
            nodes: new Map(),
            edges: new Map(),
            outgoingEdges: new Map(),
            incomingEdges: new Map(),
        };
    }

    // Core accessors
    get nodes(): ReadonlyMap<string, GraphNode> {
        return this.snapshot.nodes;
    }

    get edges(): ReadonlyMap<string, GraphEdge> {
        return this.snapshot.edges;
    }

    get nodeCount(): number {
        return this.snapshot.nodes.size;
    }

    get edgeCount(): number {
        return this.snapshot.edges.size;
    }

    getNode(id: string): GraphNode | undefined {
        return this.snapshot.nodes.get(id);
    }

    getEdge(id: string): GraphEdge | undefined {
        return this.snapshot.edges.get(id);
    }

    getOutgoing(nodeId: string): GraphEdge[] {
        const edgeIds = this.snapshot.outgoingEdges.get(nodeId) ?? new Set();
        return Array.from(edgeIds)
            .map(id => this.snapshot.edges.get(id))
            .filter((e): e is GraphEdge => e !== undefined);
    }

    getIncoming(nodeId: string): GraphEdge[] {
        const edgeIds = this.snapshot.incomingEdges.get(nodeId) ?? new Set();
        return Array.from(edgeIds)
            .map(id => this.snapshot.edges.get(id))
            .filter((e): e is GraphEdge => e !== undefined);
    }

    getNeighbors(nodeId: string): GraphNode[] {
        const outgoing = this.getOutgoing(nodeId).map(e => this.getNode(e.targetId));
        const incoming = this.getIncoming(nodeId).map(e => this.getNode(e.sourceId));
        return [...outgoing, ...incoming]
            .filter((n): n is GraphNode => n !== undefined);
    }

    // Filter nodes
    findNodes(filter: NodeFilter): GraphNode[] {
        const nodes: GraphNode[] = [];
        for (const node of this.snapshot.nodes.values()) {
            if (this.matchesNodeFilter(node, filter)) {
                nodes.push(node);
            }
        }
        return nodes;
    }

    findEdges(filter: EdgeFilter): GraphEdge[] {
        const edges: GraphEdge[] = [];
        for (const edge of this.snapshot.edges.values()) {
            if (this.matchesEdgeFilter(edge, filter)) {
                edges.push(edge);
            }
        }
        return edges;
    }

    // Immutable update methods
    addNode(node: GraphNode): GraphStore {
        if (this.snapshot.nodes.has(node.id)) {
            return this;
        }
        return this.withDiff({ addedNodes: [node] });
    }

    addEdge(edge: GraphEdge): GraphStore {
        if (this.snapshot.edges.has(edge.id)) {
            return this;
        }
        return this.withDiff({ addedEdges: [edge] });
    }

    removeNode(id: string): GraphStore {
        if (!this.snapshot.nodes.has(id)) {
            return this;
        }
        return this.withDiff({ removedNodes: [id] });
    }

    removeEdge(id: string): GraphStore {
        if (!this.snapshot.edges.has(id)) {
            return this;
        }
        return this.withDiff({ removedEdges: [id] });
    }

    updateNode(id: string, updater: (node: GraphNode) => GraphNode): GraphStore {
        const existing = this.snapshot.nodes.get(id);
        if (!existing) {
            return this;
        }
        const updated = updater(existing);
        return this.withDiff({ updatedNodes: new Map([[id, updated]]) });
    }

    // Batch updates
    applyDiff(diff: GraphDiff): GraphStore {
        return this.withDiff(diff);
    }

    // Export to serializable format
    toSerializable(): { nodes: GraphNode[]; edges: GraphEdge[] } {
        return {
            nodes: Array.from(this.snapshot.nodes.values()),
            edges: Array.from(this.snapshot.edges.values()),
        };
    }

    // Create from serialized data
    static fromSerializable(data: { nodes: GraphNode[]; edges: GraphEdge[] }): GraphStore {
        let store = new GraphStore();
        for (const node of data.nodes) {
            store = store.addNode(node);
        }
        for (const edge of data.edges) {
            store = store.addEdge(edge);
        }
        return store;
    }

    // Internal: apply diff and produce new store
    private withDiff(diff: GraphDiff): GraphStore {
        const newNodes = new Map(this.snapshot.nodes);
        const newEdges = new Map(this.snapshot.edges);
        const newOutgoing = new Map(this.snapshot.outgoingEdges);
        const newIncoming = new Map(this.snapshot.incomingEdges);

        // Add nodes
        for (const node of diff.addedNodes) {
            newNodes.set(node.id, node);
        }

        // Remove nodes and their edges
        for (const id of diff.removedNodes) {
            newNodes.delete(id);
            const outgoing = newOutgoing.get(id) ?? new Set();
            for (const edgeId of outgoing) {
                newEdges.delete(edgeId);
            }
            const incoming = newIncoming.get(id) ?? new Set();
            for (const edgeId of incoming) {
                newEdges.delete(edgeId);
            }
            newOutgoing.delete(id);
            newIncoming.delete(id);
        }

        // Update nodes
        for (const [id, node] of diff.updatedNodes) {
            newNodes.set(id, node);
        }

        // Add edges
        for (const edge of diff.addedEdges) {
            newEdges.set(edge.id, edge);
            this.addToIndex(newOutgoing, edge.sourceId, edge.id);
            this.addToIndex(newIncoming, edge.targetId, edge.id);
        }

        // Remove edges
        for (const id of diff.removedEdges) {
            const edge = this.snapshot.edges.get(id);
            if (edge) {
                newEdges.delete(id);
                this.removeFromIndex(newOutgoing, edge.sourceId, id);
                this.removeFromIndex(newIncoming, edge.targetId, id);
            }
        }

        // Update edges
        for (const [id, edge] of diff.updatedEdges) {
            const old = this.snapshot.edges.get(id);
            if (old) {
                this.removeFromIndex(newOutgoing, old.sourceId, id);
                this.removeFromIndex(newIncoming, old.targetId, id);
            }
            newEdges.set(id, edge);
            this.addToIndex(newOutgoing, edge.sourceId, id);
            this.addToIndex(newIncoming, edge.targetId, id);
        }

        return new GraphStore({
            nodes: newNodes,
            edges: newEdges,
            outgoingEdges: newOutgoing,
            incomingEdges: newIncoming,
        });
    }

    private addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
        const set = index.get(key);
        if (set) {
            set.add(value);
        } else {
            index.set(key, new Set([value]));
        }
    }

    private removeFromIndex(index: Map<string, Set<string>>, key: string, value: string): void {
        const set = index.get(key);
        if (set) {
            set.delete(value);
            if (set.size === 0) {
                index.delete(key);
            }
        }
    }

    private matchesNodeFilter(node: GraphNode, filter: NodeFilter): boolean {
        if (filter.kind) {
            const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind];
            if (!kinds.includes(node.kind)) return false;
        }
        if (filter.filePath) {
            const pattern = filter.filePath instanceof RegExp ? filter.filePath : new RegExp(filter.filePath);
            if (!pattern.test(node.filePath)) return false;
        }
        if (filter.name) {
            const pattern = filter.name instanceof RegExp ? filter.name : new RegExp(filter.name);
            if (!pattern.test(node.name)) return false;
        }
        if (filter.isExported !== undefined && node.isExported !== filter.isExported) {
            return false;
        }
        if (filter.language && node.language !== filter.language) {
            return false;
        }
        return true;
    }

    private matchesEdgeFilter(edge: GraphEdge, filter: EdgeFilter): boolean {
        if (filter.kind) {
            const kinds = Array.isArray(filter.kind) ? filter.kind : [filter.kind];
            if (!kinds.includes(edge.kind)) return false;
        }
        if (filter.sourceId && edge.sourceId !== filter.sourceId) return false;
        if (filter.targetId && edge.targetId !== filter.targetId) return false;
        if (filter.minConfidence !== undefined && edge.confidence < filter.minConfidence) {
            return false;
        }
        return true;
    }
}

// Factory function
export function createGraphStore(): GraphStore {
    return new GraphStore();
}
import fs from 'fs/promises';
import path from 'path';
import { GraphStore } from './graph-store.js';
import { GraphSerializer, SerializedGraph } from './serialization.js';

export interface BackupInfo {
    path: string;
    timestamp: Date;
    size: number;
    metadata: {
        nodeCount: number;
        edgeCount: number;
        languages: string[];
    };
}

export class GraphBackupManager {
    private backupDir: string;
    private maxBackups: number;

    constructor(backupDir: string, maxBackups: number = 5) {
        this.backupDir = backupDir;
        this.maxBackups = maxBackups;
    }

    async createBackup(store: GraphStore, name?: string): Promise<string> {
        await fs.mkdir(this.backupDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = name ? `${name}_${timestamp}` : `backup_${timestamp}`;
        const backupPath = path.join(this.backupDir, `${backupName}.json`);

        const serialized = GraphSerializer.serialize(store);
        await fs.writeFile(backupPath, JSON.stringify(serialized, null, 2), 'utf-8');

        await this.cleanupOldBackups();

        return backupPath;
    }

    async restoreBackup(backupPath: string): Promise<GraphStore> {
        const content = await fs.readFile(backupPath, 'utf-8');
        const data = JSON.parse(content) as SerializedGraph;
        return GraphSerializer.deserialize(data);
    }

    async listBackups(): Promise<BackupInfo[]> {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups: BackupInfo[] = [];

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(this.backupDir, file);
                const stat = await fs.stat(filePath);

                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content) as SerializedGraph;

                    backups.push({
                        path: filePath,
                        timestamp: new Date(stat.mtime),
                        size: stat.size,
                        metadata: {
                            nodeCount: data.metadata.nodeCount,
                            edgeCount: data.metadata.edgeCount,
                            languages: data.metadata.languages,
                        },
                    });
                } catch {
                    backups.push({
                        path: filePath,
                        timestamp: new Date(stat.mtime),
                        size: stat.size,
                        metadata: { nodeCount: 0, edgeCount: 0, languages: [] },
                    });
                }
            }

            backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            return backups;
        } catch {
            return [];
        }
    }

    private async cleanupOldBackups(): Promise<void> {
        const backups = await this.listBackups();

        if (backups.length > this.maxBackups) {
            const toDelete = backups.slice(this.maxBackups);
            for (const backup of toDelete) {
                await fs.unlink(backup.path).catch(() => { });
            }
        }
    }

    async getLatestBackup(): Promise<BackupInfo | null> {
        const backups = await this.listBackups();
        return backups.length > 0 ? backups[0] : null;
    }
}

export function createBackupManager(backupDir: string, maxBackups?: number): GraphBackupManager {
    return new GraphBackupManager(backupDir, maxBackups);
}