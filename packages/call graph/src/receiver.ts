import type { CallSite, CallContext } from './types.js';

// Resolve receiver type for member calls
export async function resolveReceiverType(
    callSite: CallSite,
    context: CallContext
): Promise<string | null> {
    if (callSite.callForm !== 'member' || !callSite.receiver) {
        return null;
    }

    const receiverName = callSite.receiver;

    // Check type environment first
    if (context.typeEnv.has(receiverName)) {
        return context.typeEnv.get(receiverName)!;
    }

    // Check if receiver is a known class name
    for (const [id, node] of context.symbols) {
        if ((node.kind === 'Class' || node.kind === 'Interface') && node.name === receiverName) {
            return receiverName;
        }
    }

    // Handle 'this', 'self', 'super' keywords
    if (receiverName === 'this' || receiverName === 'self') {
        // Find enclosing class
        const enclosingClass = findEnclosingClass(callSite, context);
        if (enclosingClass) {
            return enclosingClass;
        }
    }

    if (receiverName === 'super') {
        // Would need inheritance info - return null for now
        return null;
    }

    // Check if receiver is an imported symbol
    const imports = context.imports.get(context.currentFile);
    if (imports?.has(receiverName)) {
        return receiverName;
    }

    return null;
}

// Find enclosing class for this/self resolution
function findEnclosingClass(callSite: CallSite, context: CallContext): string | null {
    // Find the source symbol (the function containing the call)
    const sourceSymbol = context.symbols.get(callSite.sourceId);
    if (!sourceSymbol) return null;

    // Check if source is a method (has parent class)
    // This would require class-method relationship data
    // Simplified: check if source name suggests it's a method in a class
    const parts = sourceSymbol.id.split(':');
    if (parts.length >= 3) {
        const potentialClass = parts[parts.length - 2];
        if (context.symbols.has(`Class:${potentialClass}`)) {
            return potentialClass;
        }
    }

    return null;
}

// Resolve receiver from chain calls (e.g., a.b().c())
export function resolveChainReceiver(
    chain: string[],
    baseType: string | null,
    context: CallContext
): string | null {
    if (!baseType) return null;

    let currentType = baseType;

    for (const step of chain) {
        // Look up method return type for this step
        // This would need method signature data
        const methodReturnType = getMethodReturnType(currentType, step, context);
        if (!methodReturnType) return null;
        currentType = methodReturnType;
    }

    return currentType;
}

// Get method return type (stub - would need method signatures)
function getMethodReturnType(
    className: string,
    methodName: string,
    context: CallContext
): string | null {
    // Find class node
    for (const [id, node] of context.symbols) {
        if (node.kind === 'Class' && node.name === className) {
            // Look for method with this name
            // This would need class-method relationships
            // Simplified: return null for now
            break;
        }
    }
    return null;
}