import type { GraphNode } from '@codeagent/core-types';
import type { HeritageEdge, InheritanceNode, MROResult } from './types.js';

// Build inheritance graph from heritage edges
export class InheritanceGraph {
    private nodes: Map<string, InheritanceNode> = new Map();
    private edges: HeritageEdge[] = [];

    addEdge(edge: HeritageEdge): void {
        this.edges.push(edge);

        // Update source node
        let source = this.nodes.get(edge.sourceId);
        if (!source) {
            source = {
                id: edge.sourceId,
                name: '',
                filePath: edge.sourceFile,
                kind: 'class',
                parents: [],
                children: [],
                interfaces: [],
            };
            this.nodes.set(edge.sourceId, source);
        }

        // Update target node
        let target = this.nodes.get(edge.targetId);
        if (!target) {
            target = {
                id: edge.targetId,
                name: '',
                filePath: edge.targetFile,
                kind: edge.kind === 'implements' ? 'interface' : 'class',
                parents: [],
                children: [],
                interfaces: [],
            };
            this.nodes.set(edge.targetId, target);
        }

        // Add relationship
        if (edge.kind === 'extends') {
            source.parents.push(edge.targetId);
            target.children.push(edge.sourceId);
        } else if (edge.kind === 'implements') {
            source.interfaces.push(edge.targetId);
        }
    }

    addNode(node: GraphNode): void {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, {
                id: node.id,
                name: node.name,
                filePath: node.filePath,
                kind: node.kind === 'Interface' ? 'interface' : 'class',
                parents: [],
                children: [],
                interfaces: [],
            });
        } else {
            const existing = this.nodes.get(node.id)!;
            existing.name = node.name;
            existing.filePath = node.filePath;
            existing.kind = node.kind === 'Interface' ? 'interface' : 'class';
        }
    }

    getNode(id: string): InheritanceNode | undefined {
        return this.nodes.get(id);
    }

    getAllNodes(): InheritanceNode[] {
        return Array.from(this.nodes.values());
    }

    getChildren(id: string): InheritanceNode[] {
        const node = this.nodes.get(id);
        if (!node) return [];
        return node.children.map(cid => this.nodes.get(cid)).filter((n): n is InheritanceNode => n !== undefined);
    }

    getParents(id: string): InheritanceNode[] {
        const node = this.nodes.get(id);
        if (!node) return [];
        return node.parents.map(pid => this.nodes.get(pid)).filter((n): n is InheritanceNode => n !== undefined);
    }

    getInterfaces(id: string): InheritanceNode[] {
        const node = this.nodes.get(id);
        if (!node) return [];
        return node.interfaces.map(iid => this.nodes.get(iid)).filter((n): n is InheritanceNode => n !== undefined);
    }

    // Get all ancestors (breadth-first)
    getAncestors(id: string): InheritanceNode[] {
        const ancestors: InheritanceNode[] = [];
        const visited = new Set<string>();
        const queue = [id];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const node = this.nodes.get(current);
            if (node) {
                for (const parentId of node.parents) {
                    if (!visited.has(parentId)) {
                        const parent = this.nodes.get(parentId);
                        if (parent) {
                            ancestors.push(parent);
                            queue.push(parentId);
                        }
                    }
                }
            }
        }

        return ancestors;
    }

    // Get all descendants
    getDescendants(id: string): InheritanceNode[] {
        const descendants: InheritanceNode[] = [];
        const visited = new Set<string>();
        const queue = [id];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const node = this.nodes.get(current);
            if (node) {
                for (const childId of node.children) {
                    if (!visited.has(childId)) {
                        const child = this.nodes.get(childId);
                        if (child) {
                            descendants.push(child);
                            queue.push(childId);
                        }
                    }
                }
            }
        }

        return descendants;
    }

    // Check if a class is a subclass of another
    isSubclassOf(childId: string, parentId: string): boolean {
        const ancestors = this.getAncestors(childId);
        return ancestors.some(a => a.id === parentId);
    }

    // Find common ancestor(s)
    findCommonAncestor(id1: string, id2: string): InheritanceNode | null {
        const ancestors1 = new Set(this.getAncestors(id1).map(a => a.id));
        const ancestors2 = this.getAncestors(id2);

        for (const ancestor of ancestors2) {
            if (ancestors1.has(ancestor.id)) {
                return ancestor;
            }
        }

        return null;
    }

    // Export to JSON
    toJSON(): object {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
        };
    }
}

// Build inheritance graph from symbols and heritage edges
export function buildInheritanceGraph(
    symbols: GraphNode[],
    heritageEdges: HeritageEdge[]
): InheritanceGraph {
    const graph = new InheritanceGraph();

    // Add all symbols
    for (const symbol of symbols) {
        if (symbol.kind === 'Class' || symbol.kind === 'Interface') {
            graph.addNode(symbol);
        }
    }

    // Add all heritage edges
    for (const edge of heritageEdges) {
        graph.addEdge(edge);
    }

    return graph;
}