import type { GraphNode, GraphEdge } from '@codeagent/core-types';
import { GraphStore } from './graph-store.js';

export interface Path {
    nodes: GraphNode[];
    edges: GraphEdge[];
    length: number;
}

export class PathFinder {
    constructor(private store: GraphStore) { }

    // Find shortest path between nodes using BFS
    shortestPath(fromId: string, toId: string): Path | null {
        if (fromId === toId) {
            const node = this.store.getNode(fromId);
            return node ? { nodes: [node], edges: [], length: 0 } : null;
        }

        const queue: Array<{ id: string; path: Path }> = [{ id: fromId, path: { nodes: [], edges: [], length: 0 } }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (visited.has(id)) continue;
            visited.add(id);

            const outgoing = this.store.getOutgoing(id);
            for (const edge of outgoing) {
                const neighbor = this.store.getNode(edge.targetId);
                if (!neighbor) continue;

                const newPath: Path = {
                    nodes: [...path.nodes, neighbor],
                    edges: [...path.edges, edge],
                    length: path.length + 1,
                };

                if (edge.targetId === toId) {
                    return newPath;
                }

                if (!visited.has(edge.targetId)) {
                    queue.push({ id: edge.targetId, path: newPath });
                }
            }
        }

        return null;
    }

    // Find all paths up to maxDepth (limited for performance)
    findAllPaths(fromId: string, toId: string, maxDepth: number = 5): Path[] {
        const results: Path[] = [];
        const visited = new Set<string>();

        const dfs = (currentId: string, path: Path) => {
            if (path.length >= maxDepth) return;
            if (currentId === toId && path.length > 0) {
                results.push(path);
                return;
            }

            visited.add(currentId);
            const outgoing = this.store.getOutgoing(currentId);

            for (const edge of outgoing) {
                if (visited.has(edge.targetId)) continue;
                const neighbor = this.store.getNode(edge.targetId);
                if (!neighbor) continue;

                dfs(edge.targetId, {
                    nodes: [...path.nodes, neighbor],
                    edges: [...path.edges, edge],
                    length: path.length + 1,
                });
            }

            visited.delete(currentId);
        };

        const startNode = this.store.getNode(fromId);
        if (startNode) {
            dfs(fromId, { nodes: [startNode], edges: [], length: 0 });
        }

        return results;
    }

    // Find all nodes within N hops
    nodesWithinHops(startId: string, maxHops: number): GraphNode[] {
        const visited = new Set<string>();
        const result: GraphNode[] = [];
        let frontier = [startId];

        for (let hops = 0; hops < maxHops; hops++) {
            const next: string[] = [];
            for (const id of frontier) {
                if (visited.has(id)) continue;
                visited.add(id);
                const node = this.store.getNode(id);
                if (node && id !== startId) result.push(node);
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

export function findPaths(store: GraphStore): PathFinder {
    return new PathFinder(store);
}