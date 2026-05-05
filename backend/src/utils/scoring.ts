import { ProcessStatus, IEvaluationRules, ScoreResult } from '../types';
import { getDefaultRules } from '../models/EvaluationConfig';

/**
 * Calculate process score based on delivery date relative to planned and limit dates
 * 
 * Scoring rules:
 * - Before planned date: 100 points (early delivery)
 * - On planned date: 75 points (on time)
 * - First half of interval (planned to midpoint): 50 points
 * - Second half of interval (midpoint to limit): 25 points  
 * - After limit date: 0 points (critical)
 */
export function calculateScore(
    plannedDate: Date,
    limitDate: Date,
    deliveryDate: Date,
    rules: IEvaluationRules = getDefaultRules()
): ScoreResult {
    // Normalize dates to midnight to ignore time part
    const normalize = (d: Date) => {
        const normalized = new Date(d);
        normalized.setHours(0, 0, 0, 0);
        return normalized.getTime();
    };

    const P = normalize(plannedDate);
    const L = normalize(limitDate);
    const E = normalize(deliveryDate);

    // Apply tolerance days (extend limit)
    const toleranceMs = (rules.toleranceDays || 0) * 24 * 60 * 60 * 1000;
    const adjustedL = L + toleranceMs;

    // Calculate halfway point
    // We use actual ms for the interval, then decide based on normalized E
    const halfInterval = (adjustedL - P) / 2;
    const halfwayPoint = P + halfInterval;

    // Past limit (even with tolerance) = CRITICAL
    if (E > adjustedL) {
        return {
            score: rules.criticalScore,
            status: ProcessStatus.CRITICAL
        };
    }

    // Before or exactly on planned date = perfect/on-time
    if (E <= P) {
        return {
            score: E < P ? rules.earlyDeliveryScore : rules.onTimeScore,
            status: ProcessStatus.ON_TIME
        };
    }

    // First half of interval after planned (up to midpoint)
    if (E <= halfwayPoint) {
        return {
            score: rules.halfwayScore,
            status: ProcessStatus.LATE
        };
    }

    // Second half (still within limit + tolerance)
    return {
        score: rules.lateScore,
        status: ProcessStatus.LATE
    };
}

/**
 * Calculate deviation in days between delivery and planned date
 * Positive = late, Negative = early
 */
export function calculateDeviationDays(
    plannedDate: Date,
    deliveryDate: Date
): number {
    const diffMs = deliveryDate.getTime() - plannedDate.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Get current status based on dates (without delivery)
 */
export function getPendingStatus(
    plannedDate: Date,
    limitDate: Date,
    currentDate: Date = new Date()
): ProcessStatus {
    const now = currentDate.getTime();
    const L = limitDate.getTime();

    if (now > L) {
        return ProcessStatus.CRITICAL;
    }

    const P = plannedDate.getTime();
    if (now > P) {
        return ProcessStatus.LATE;
    }

    return ProcessStatus.PENDING;
}

