import type { CallForm } from './types.js';

// Detect the form of a call from its syntax
export function detectCallForm(
    callText: string,
    context?: { hasDot?: boolean; hasNew?: boolean; hasDoubleColon?: boolean }
): CallForm {
    // Constructor call (new keyword)
    if (callText.trim().startsWith('new ') || context?.hasNew) {
        return 'constructor';
    }

    // Static call (:: in PHP, . in static context)
    if (context?.hasDoubleColon || /::\w+\s*\(/.test(callText)) {
        return 'static';
    }

    // Member call (dot or arrow)
    if (context?.hasDot || /\.\w+\s*\(/.test(callText) || /->\w+\s*\(/.test(callText)) {
        return 'member';
    }

    // Free function call
    return 'free';
}

// Extract receiver from member call
export function extractReceiver(callText: string): string | null {
    // Match pattern: something.method()
    const memberMatch = callText.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z_][a-zA-Z0-9_]*\s*\(/);
    if (memberMatch) {
        return memberMatch[1];
    }

    // Match pattern: something->method() (PHP, C++)
    const arrowMatch = callText.match(/([a-zA-Z_][a-zA-Z0-9_]*)->[a-zA-Z_][a-zA-Z0-9_]*\s*\(/);
    if (arrowMatch) {
        return arrowMatch[1];
    }

    // Match pattern: $this->method() (PHP)
    const thisMatch = callText.match(/\$this->[a-zA-Z_][a-zA-Z0-9_]*\s*\(/);
    if (thisMatch) {
        return '$this';
    }

    // Match pattern: self::method() (PHP, static)
    const selfMatch = callText.match(/self::[a-zA-Z_][a-zA-Z0-9_]*\s*\(/);
    if (selfMatch) {
        return 'self';
    }

    return null;
}

// Check if call is part of a chain (e.g., a.b().c())
export function isChainedCall(callText: string, position: number): boolean {
    // Look for preceding dot or arrow before the call
    const beforeCall = callText.slice(0, position);
    return /\.\s*$/.test(beforeCall) || /->\s*$/.test(beforeCall);
}

// Get chain depth for nested calls
export function getChainDepth(callText: string, position: number): number {
    let depth = 0;
    let currentPos = position;
    const beforeCall = callText.slice(0, currentPos);

    // Count consecutive member accesses
    const matches = beforeCall.match(/(\.|->)[a-zA-Z_][a-zA-Z0-9_]*\s*\(?/g);
    return matches?.length || 0;
}