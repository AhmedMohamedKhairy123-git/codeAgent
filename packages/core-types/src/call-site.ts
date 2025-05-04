import type { SyntaxNode } from 'tree-sitter';
import type { CallSite, CallForm } from './types.js';
import { detectCallForm, extractReceiver, isChainedCall, getChainDepth } from './call-form.js';

// Extract call sites from AST node
export function extractCallSites(
    node: SyntaxNode,
    filePath: string,
    sourceId: string,
    content: string
): CallSite[] {
    const callSites: CallSite[] = [];

    // Recursively traverse AST for call expressions
    function traverse(current: SyntaxNode) {
        if (isCallNode(current)) {
            const callSite = extractCallSite(current, filePath, sourceId, content);
            if (callSite) {
                callSites.push(callSite);
            }
        }

        for (const child of current.children) {
            traverse(child);
        }
    }

    traverse(node);
    return callSites;
}

// Check if a node is a call expression
function isCallNode(node: SyntaxNode): boolean {
    const callTypes = [
        'call_expression',
        'method_invocation',
        'function_call_expression',
        'member_call_expression',
        'invocation_expression',
        'call',
    ];
    return callTypes.includes(node.type);
}

// Extract a single call site
function extractCallSite(
    node: SyntaxNode,
    filePath: string,
    sourceId: string,
    content: string
): CallSite | null {
    // Extract the called name
    const nameNode = findCallNameNode(node);
    if (!nameNode) return null;

    const calledName = nameNode.text;
    const callText = content.slice(node.startIndex, node.endIndex);
    const context = extractCallContext(node);

    const callForm = detectCallForm(callText, context);
    const receiver = callForm === 'member' ? extractReceiver(callText) : undefined;

    return {
        filePath,
        calledName,
        sourceId,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        argumentCount: countArguments(node),
        callForm,
        receiver: receiver || undefined,
        isChained: isChainedCall(content, node.startIndex),
        chainDepth: getChainDepth(content, node.startIndex),
    };
}

// Find the name node within a call expression
function findCallNameNode(node: SyntaxNode): SyntaxNode | null {
    // Try named field first
    const funcNode = node.childForFieldName('function');
    if (funcNode) {
        // If function is a member expression, get the property name
        if (funcNode.type === 'member_expression') {
            const propNode = funcNode.childForFieldName('property');
            if (propNode) return propNode;
        }
        return funcNode;
    }

    // Try name field
    const nameNode = node.childForFieldName('name');
    if (nameNode) return nameNode;

    // Try method field
    const methodNode = node.childForFieldName('method');
    if (methodNode) return methodNode;

    // Fallback: look for identifier children
    for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
            return child;
        }
    }

    return null;
}

// Count arguments in call
function countArguments(node: SyntaxNode): number {
    let argsNode = node.childForFieldName('arguments');
    if (!argsNode) {
        // Try to find arguments by type
        for (const child of node.children) {
            if (child.type === 'arguments' || child.type === 'argument_list') {
                argsNode = child;
                break;
            }
        }
    }

    if (!argsNode) return 0;

    let count = 0;
    for (const child of argsNode.children) {
        if (child.isNamed && child.type !== 'comment') {
            count++;
        }
    }

    return count;
}

// Extract context for call form detection
function extractCallContext(node: SyntaxNode): { hasDot?: boolean; hasNew?: boolean; hasDoubleColon?: boolean } {
    const context: { hasDot?: boolean; hasNew?: boolean; hasDoubleColon?: boolean } = {};

    // Check for 'new' keyword in ancestors
    let current = node.parent;
    while (current) {
        if (current.type === 'new_expression') {
            context.hasNew = true;
            break;
        }
        current = current.parent;
    }

    // Check for dot or arrow in the call text
    const callText = node.text;
    context.hasDot = callText.includes('.');
    context.hasDoubleColon = callText.includes('::');

    return context;
}