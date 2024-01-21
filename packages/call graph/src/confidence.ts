import type { CallSite, ConfidenceLevel } from './types.js';

// Confidence levels
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Calculate confidence score for a resolved call
export function calculateConfidence(
    callSite: CallSite,
    targetType: string,
    resolutionMethod: string,
    hasMultipleCandidates: boolean
): ConfidenceLevel {
    let score = 1.0;
    let reason = '';

    // Factor 1: Call form affects confidence
    switch (callSite.callForm) {
        case 'constructor':
            score *= 0.95;
            reason += 'constructor call; ';
            break;
        case 'member':
            score *= 0.9;
            reason += 'member call; ';
            break;
        case 'static':
            score *= 0.85;
            reason += 'static call; ';
            break;
        case 'free':
            score *= 0.8;
            reason += 'free call; ';
            break;
    }

    // Factor 2: Receiver type affects confidence
    if (callSite.receiverType) {
        score *= 1.0;
        reason += 'receiver type known; ';
    } else if (callSite.receiver) {
        score *= 0.7;
        reason += 'receiver unknown; ';
    }

    // Factor 3: Resolution method
    switch (resolutionMethod) {
        case 'exact-match':
            score *= 1.0;
            reason += 'exact match; ';
            break;
        case 'import-scoped':
            score *= 0.95;
            reason += 'import scoped; ';
            break;
        case 'same-file':
            score *= 0.9;
            reason += 'same file; ';
            break;
        case 'global':
            score *= 0.6;
            reason += 'global fallback; ';
            break;
        default:
            score *= 0.5;
            reason += 'fallback; ';
    }

    // Factor 4: Multiple candidates reduces confidence
    if (hasMultipleCandidates) {
        score *= 0.5;
        reason += 'multiple candidates; ';
    }

    // Factor 5: Argument count affects confidence
    const targetParamCount = getTargetParameterCount(targetType);
    if (targetParamCount !== undefined && targetParamCount !== callSite.argumentCount) {
        score *= 0.6;
        reason += 'argument count mismatch; ';
    }

    // Determine level
    let level: 'high' | 'medium' | 'low';
    if (score >= 0.8) {
        level = 'high';
    } else if (score >= 0.5) {
        level = 'medium';
    } else {
        level = 'low';
    }

    return {
        level,
        score: Math.round(score * 100) / 100,
        reason: reason.trim(),
    };
}

// Helper to get target parameter count (stub - would come from symbol table)
function getTargetParameterCount(targetType: string): number | undefined {
    // This would look up the target symbol and return its parameter count
    // For now, return undefined
    return undefined;
}

// Pre-defined confidence thresholds
export const ConfidenceThresholds = {
    HIGH: 0.8,
    MEDIUM: 0.5,
    LOW: 0.3,
};

// Check if a call should be included based on minimum confidence
export function shouldIncludeCall(confidence: ConfidenceLevel, minConfidence: number = 0): boolean {
    return confidence.score >= minConfidence;
}