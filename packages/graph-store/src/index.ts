import type { GraphEdge, GraphNode, RelationKind } from '@codeagent/core-types';

export interface GraphSnapshot {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

export interface GraphDiff {
    addedNodes: GraphNode[];
    removedNodes: GraphNode[];
    addedEdges: GraphEdge[];
    removedEdges: GraphEdge[];
}

export class GraphStore {
    private readonly nodesById = new Map<string, GraphNode>();
    private readonly edgesById = new Map<string, GraphEdge>();

    constructor(initial?: Partial<GraphSnapshot>) {
        for (const node of initial?.nodes ?? []) {
            this.nodesById.set(node.id, node);
        }

        for (const edge of initial?.edges ?? []) {
            this.edgesById.set(edge.id, edge);
        }
    }

    get nodes(): GraphNode[] {
        return Array.from(this.nodesById.values());
    }

    get edges(): GraphEdge[] {
        return Array.from(this.edgesById.values());
    }

    getNode(id: string): GraphNode | undefined {
        return this.nodesById.get(id);
    }

    addNode(node: GraphNode): this {
        this.nodesById.set(node.id, node);
        return this;
    }

    removeNode(id: string): this {
        this.nodesById.delete(id);
        for (const [edgeId, edge] of this.edgesById.entries()) {
            if (edge.sourceId === id || edge.targetId === id) {
                this.edgesById.delete(edgeId);
            }
        }
        return this;
    }

    addEdge(edge: GraphEdge): this {
        if (!this.nodesById.has(edge.sourceId) || !this.nodesById.has(edge.targetId)) {
            throw new Error('Both source and target nodes must exist before adding an edge.');
        }
        this.edgesById.set(edge.id, edge);
        return this;
    }

    removeEdge(id: string): this {
        this.edgesById.delete(id);
        return this;
    }

    toSnapshot(): GraphSnapshot {
        return {
            nodes: this.nodes,
            edges: this.edges
        };
    }

    diff(previous: GraphSnapshot): GraphDiff {
        const current = this.toSnapshot();
        const previousNodesById = new Map(previous.nodes.map((n) => [n.id, n]));
        const previousEdgesById = new Map(previous.edges.map((e) => [e.id, e]));

        return {
            addedNodes: current.nodes.filter((node) => !previousNodesById.has(node.id)),
            removedNodes: previous.nodes.filter((node) => !this.nodesById.has(node.id)),
            addedEdges: current.edges.filter((edge) => !previousEdgesById.has(edge.id)),
            removedEdges: previous.edges.filter((edge) => !this.edgesById.has(edge.id))
        };
    }
}

export function createGraphStore(initial?: Partial<GraphSnapshot>): GraphStore {
    return new GraphStore(initial);
}

export class GraphQuery {
    constructor(private readonly store: GraphStore) { }

    byKind(kind: GraphNode['kind']): GraphNode[] {
        return this.store.nodes.filter((node) => node.kind === kind);
    }

    byName(name: string): GraphNode[] {
        return this.store.nodes.filter((node) => node.name === name);
    }

    relatedTo(nodeId: string, relationKind?: RelationKind): GraphNode[] {
        const neighborIds = new Set<string>();
        for (const edge of this.store.edges) {
            if (relationKind && edge.kind !== relationKind) {
                continue;
            }

            if (edge.sourceId === nodeId) {
                neighborIds.add(edge.targetId);
            }
            if (edge.targetId === nodeId) {
                neighborIds.add(edge.sourceId);
            }
        }

        return Array.from(neighborIds)
            .map((id) => this.store.getNode(id))
            .filter((node): node is GraphNode => Boolean(node));
    }
}

export class QueryBuilder {
    private nodeKind?: GraphNode['kind'];
    private nodeName?: string;

    constructor(private readonly store: GraphStore) { }

    kind(kind: GraphNode['kind']): this {
        this.nodeKind = kind;
        return this;
    }

    name(name: string): this {
        this.nodeName = name;
        return this;
    }

    execute(): GraphNode[] {
        return this.store.nodes.filter((node) => {
            if (this.nodeKind && node.kind !== this.nodeKind) {
                return false;
            }
            if (this.nodeName && node.name !== this.nodeName) {
                return false;
            }
            return true;
        });
    }
}

export class PathFinder {
    constructor(private readonly store: GraphStore) { }

    shortestPath(fromNodeId: string, toNodeId: string): string[] {
        if (fromNodeId === toNodeId) {
            return [fromNodeId];
        }

        const adjacency = new Map<string, string[]>();
        for (const node of this.store.nodes) {
            adjacency.set(node.id, []);
        }

        for (const edge of this.store.edges) {
            adjacency.get(edge.sourceId)?.push(edge.targetId);
            adjacency.get(edge.targetId)?.push(edge.sourceId);
        }

        const queue: string[] = [fromNodeId];
        const visited = new Set<string>([fromNodeId]);
        const previous = new Map<string, string>();

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                break;
            }

            if (current === toNodeId) {
                const path: string[] = [];
                let cursor: string | undefined = toNodeId;
                while (cursor) {
                    path.push(cursor);
                    cursor = previous.get(cursor);
                }
                return path.reverse();
            }

            for (const next of adjacency.get(current) ?? []) {
                if (!visited.has(next)) {
                    visited.add(next);
                    previous.set(next, current);
                    queue.push(next);
                }
            }
        }

        return [];
    }
}