"use strict";
/**
 * PROVN Best-Effort In-Memory Rate Limiter
 *
 * WARNING: This is NOT authoritative security. In serverless environments (Vercel Lambda),
 * in-memory state resets on cold starts and is not shared across instances.
 * This exists only as a first-line UX protection to provide immediate feedback.
 * All real security enforcement (daily quota, challenge consumption) is handled
 * atomically in Postgres.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const ipStore = new Map();
const walletStore = new Map();
// Clean up expired entries every 10 minutes (unref'd to prevent event loop hanging)
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipStore.entries()) {
        if (now > record.resetTime)
            ipStore.delete(key);
    }
    for (const [key, record] of walletStore.entries()) {
        if (now > record.resetTime)
            walletStore.delete(key);
    }
}, 600000);
if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
}
function checkRateLimit(identifier, type, limit = 10, windowMs = 900000 // 15 minutes
) {
    const store = type === 'ip' ? ipStore : walletStore;
    const now = Date.now();
    const record = store.get(identifier);
    if (!record || now > record.resetTime) {
        const newRecord = { count: 1, resetTime: now + windowMs };
        store.set(identifier, newRecord);
        return { allowed: true, remaining: limit - 1, resetTime: newRecord.resetTime };
    }
    if (record.count >= limit) {
        const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetTime: record.resetTime,
            error: `Rate limit exceeded (${type.toUpperCase()}: max ${limit} logs per 15 minutes). Retry in ${retryAfterSec}s.`,
        };
    }
    record.count++;
    return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}
