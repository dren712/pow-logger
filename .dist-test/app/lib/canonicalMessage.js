"use strict";
/**
 * PROVN Canonical Proof Message Builder (SIWS-Inspired)
 *
 * Cryptographically binds wallet address, content, evidence links (GitHub & Demo URLs),
 * timestamp, and unique nonce into a standardized, tamper-evident Solana signed proof message.
 * Follows Sign-In-With-Solana (SIWS) domain-binding and wallet authentication principles.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_PROTOCOL_VERSION = void 0;
exports.decodeBase58 = decodeBase58;
exports.validateAndNormalizeUrl = validateAndNormalizeUrl;
exports.getVerifiedDomain = getVerifiedDomain;
exports.isConfiguredSupabaseUrl = isConfiguredSupabaseUrl;
exports.buildCanonicalSubmitMessageV2 = buildCanonicalSubmitMessageV2;
exports.buildCanonicalSubmitMessage = buildCanonicalSubmitMessage;
exports.buildCanonicalRetryMessageV2 = buildCanonicalRetryMessageV2;
exports.buildCanonicalRetryMessage = buildCanonicalRetryMessage;
exports.buildCanonicalArchiveMessage = buildCanonicalArchiveMessage;
exports.buildCanonicalVisibilityMessage = buildCanonicalVisibilityMessage;
exports.verifyLogCryptographically = verifyLogCryptographically;
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
function decodeBase58(str) {
    const bs58Obj = bs58_1.default;
    const fn = bs58Obj.decode || bs58Obj.default?.decode;
    if (!fn)
        throw new Error('Base58 decoder unavailable');
    return fn(str);
}
exports.CURRENT_PROTOCOL_VERSION = 2;
/**
 * Normalizes and validates URLs using native URL parsing.
 * Enforces HTTPS scheme and restricts GitHub URLs to github.com domain.
 */
function validateAndNormalizeUrl(urlInput, type) {
    if (!urlInput || typeof urlInput !== 'string')
        return null;
    const trimmed = urlInput.trim();
    if (!trimmed || trimmed.length > 300)
        return null;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:')
            return null;
        if (type === 'github') {
            const hostname = parsed.hostname.toLowerCase();
            if (hostname !== 'github.com' && !hostname.endsWith('.github.com')) {
                return null;
            }
        }
        return parsed.toString();
    }
    catch {
        return null;
    }
}
/**
 * Resolves and validates the canonical domain for SIWS verification.
 * Prevents Host header injection by enforcing configured app domain or whitelisted patterns.
 */
function getVerifiedDomain(reqHost) {
    if (process.env.NEXT_PUBLIC_APP_DOMAIN) {
        return process.env.NEXT_PUBLIC_APP_DOMAIN.trim().toLowerCase().split(':')[0];
    }
    if (!reqHost || typeof reqHost !== 'string') {
        return 'provn-sol.vercel.app';
    }
    const cleanHost = reqHost.trim().toLowerCase().split(':')[0];
    const isVercel = cleanHost === 'provn-sol.vercel.app' || cleanHost.endsWith('.vercel.app');
    const isLocalhost = cleanHost === 'localhost' || cleanHost === '127.0.0.1';
    const isWhitelisted = process.env.ALLOWED_DOMAINS
        ? process.env.ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).includes(cleanHost)
        : false;
    if (isVercel || isLocalhost || isWhitelisted) {
        return cleanHost;
    }
    return 'provn-sol.vercel.app';
}
/**
 * Helper to check if a Supabase URL is configured with a real live project domain
 * rather than a placeholder string or missing env var.
 */
function isConfiguredSupabaseUrl(url) {
    if (!url || typeof url !== 'string')
        return false;
    const lower = url.toLowerCase().trim();
    return !lower.includes('placeholder') && !lower.includes('dummy-test') && lower.startsWith('http');
}
function buildCanonicalSubmitMessageV2(params) {
    const domain = params.domain ? params.domain.trim().toLowerCase().split(':')[0] : 'provn-sol.vercel.app';
    const cleanContent = params.content.trim();
    const cleanGithubUrl = validateAndNormalizeUrl(params.githubUrl, 'github') || 'none';
    const cleanEvidenceUrl = validateAndNormalizeUrl(params.evidenceUrl, 'evidence') || 'none';
    return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}
Content: ${cleanContent}
GitHub URL: ${cleanGithubUrl}
Evidence URL: ${cleanEvidenceUrl}`;
}
/**
 * Builds canonical proof message for initial log submission (SIWS-inspired format).
 * Cryptographically binds content AND normalized evidence URLs.
 */
function buildCanonicalSubmitMessage(params) {
    const domain = params.domain ? params.domain.trim().toLowerCase().split(':')[0] : 'provn-sol.vercel.app';
    const version = params.version || 1;
    const cleanContent = params.content.trim();
    const cleanGithubUrl = validateAndNormalizeUrl(params.githubUrl, 'github') || 'none';
    const cleanEvidenceUrl = validateAndNormalizeUrl(params.evidenceUrl, 'evidence') || 'none';
    return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

SIWS Schema Version: ${version}
Nonce: ${params.nonce}
Timestamp: ${params.timestamp}
Content: ${cleanContent}
GitHub URL: ${cleanGithubUrl}
Evidence URL: ${cleanEvidenceUrl}`;
}
function buildCanonicalRetryMessageV2(params) {
    const domain = params.domain || 'provn-sol.vercel.app';
    return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Retry Archival
Log ID: ${params.logId}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`;
}
/**
 * Builds canonical SIWS prompt for authorized archival retry.
 * Cryptographically binds logId and action name to wallet.
 */
function buildCanonicalRetryMessage(params) {
    const domain = params.domain || 'provn-sol.vercel.app';
    return `${domain} wants you to sign in with your Solana account:
${params.walletAddress}

Action: Retry Archival
Log ID: ${params.logId}
Nonce: ${params.nonce}
Timestamp: ${params.timestamp}`;
}
function buildCanonicalArchiveMessage(params) {
    return `${params.domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Archive Evidence
Log ID: ${params.logId}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`;
}
function buildCanonicalVisibilityMessage(params) {
    return `${params.domain} wants you to sign in with your Solana account:
${params.walletAddress}

PROVN Protocol Version: 2
Action: Set Visibility
Log ID: ${params.logId}
Visibility: ${params.visibility}
Challenge: ${params.challenge}
Timestamp: ${params.timestamp}`;
}
/**
 * The single canonical cryptographic verification function across the PROVN protocol.
 * Reconstructs the canonical SIWS-inspired proof message and executes TweetNaCl Ed25519
 * detached signature verification against the signer's public key.
 *
 * Strict Protocol Invariants:
 * 1. Exact Domain Sealing: Uses the exact persisted domain without loose fallback guessing.
 * 2. Strict Metadata Integrity: Non-empty URLs must be valid (GitHub on github.com, Evidence on HTTPS).
 * 3. Base58 Nonce Validation: Nonce must be valid Base58 without whitespace tampering.
 * 4. Guaranteed Invariant: Returns true IF AND ONLY IF the exact persisted record is cryptographically authentic.
 */
function verifyLogCryptographically(log) {
    if (!log.wallet_address || !log.signature || !log.created_at || !log.content) {
        return false;
    }
    const challengeStr = log.challenge || log.challenge_id || (log.protocol_version === 2 ? log.nonce : null);
    const isV2 = log.protocol_version === 2 || (log.protocol_version !== 1 && !log.nonce && !!challengeStr);
    if (isV2) {
        if (!challengeStr || typeof challengeStr !== 'string' || challengeStr.trim() === '') {
            return false;
        }
    }
    else {
        // Strict Nonce Validation: Base58 string, 8-64 chars, no surrounding whitespace
        if (!log.nonce || typeof log.nonce !== 'string' || log.nonce.trim() !== log.nonce || log.nonce.length < 8 || log.nonce.length > 64) {
            return false;
        }
        try {
            const nonceBytes = decodeBase58(log.nonce);
            if (nonceBytes.length === 0)
                return false;
        }
        catch {
            return false;
        }
    }
    // Strict URL Validation: Non-empty URLs must be valid and normalized (prevent silent collapse to 'none')
    if (log.github_url && typeof log.github_url === 'string' && log.github_url.trim().length > 0) {
        const normalizedGh = validateAndNormalizeUrl(log.github_url, 'github');
        if (!normalizedGh)
            return false;
    }
    if (log.evidence_url && typeof log.evidence_url === 'string' && log.evidence_url.trim().length > 0) {
        const normalizedEv = validateAndNormalizeUrl(log.evidence_url, 'evidence');
        if (!normalizedEv)
            return false;
    }
    try {
        const publicKeyBytes = decodeBase58(log.wallet_address);
        if (publicKeyBytes.length !== 32)
            return false;
        const signatureBytes = decodeBase58(log.signature);
        if (signatureBytes.length !== 64)
            return false;
        // Exact domain: strictly use the log's persisted domain
        const domain = log.domain || 'provn-sol.vercel.app';
        let canonicalMsg;
        if (isV2) {
            canonicalMsg = buildCanonicalSubmitMessageV2({
                domain,
                walletAddress: log.wallet_address,
                content: log.content,
                timestamp: log.created_at,
                challenge: challengeStr,
                githubUrl: log.github_url || undefined,
                evidenceUrl: log.evidence_url || undefined,
            });
        }
        else {
            canonicalMsg = buildCanonicalSubmitMessage({
                domain,
                walletAddress: log.wallet_address,
                content: log.content,
                timestamp: log.created_at,
                nonce: log.nonce,
                githubUrl: log.github_url || undefined,
                evidenceUrl: log.evidence_url || undefined,
            });
        }
        const msgBytes = new TextEncoder().encode(canonicalMsg);
        return tweetnacl_1.default.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes);
    }
    catch {
        return false;
    }
}
