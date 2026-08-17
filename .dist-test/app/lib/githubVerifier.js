"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGithubUrl = parseGithubUrl;
exports.verifyGithubSource = verifyGithubSource;
/**
 * Parses a GitHub PR or Commit URL into components.
 * Returns null if the URL is not a recognized GitHub format.
 */
function parseGithubUrl(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== 'github.com' && parsedUrl.hostname !== 'www.github.com') {
            return null;
        }
        // Path parts: ['', 'owner', 'repo', 'pull'|'commit', 'identifier']
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.length < 4)
            return null;
        const owner = parts[0];
        const repo = parts[1];
        const type = parts[2];
        const identifier = parts[3];
        if (type === 'pull' || type === 'pulls') {
            // Must be numeric
            if (!/^\d+$/.test(identifier))
                return null;
            return { owner, repo, type: 'pull', identifier };
        }
        else if (type === 'commit' || type === 'commits') {
            // Basic sha validation (usually 40 chars, sometimes abbreviated)
            if (!/^[a-fA-F0-9]{7,40}$/.test(identifier))
                return null;
            return { owner, repo, type: 'commit', identifier };
        }
        return null;
    }
    catch (e) {
        return null;
    }
}
/**
 * Verifies a GitHub URL by fetching its metadata from the GitHub REST API.
 */
async function verifyGithubSource(url) {
    const parsed = parseGithubUrl(url);
    if (!parsed) {
        // If it's not a recognized GitHub URL but was submitted as evidence
        return {
            status: 'not_verified',
            provenanceLevel: 'self_attested',
            evidenceType: 'public_url',
            snapshot: null,
            error: 'Not a recognized GitHub PR or Commit URL',
        };
    }
    const evidenceType = parsed.type === 'pull' ? 'github_pr' : 'github_commit';
    const apiUrl = parsed.type === 'pull'
        ? `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.identifier}`
        : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${parsed.identifier}`;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PROVN-Evidence-Verifier',
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    try {
        const res = await fetch(apiUrl, { headers });
        if (!res.ok) {
            if (res.status === 404) {
                return {
                    status: 'failed',
                    provenanceLevel: 'source_linked', // User linked it, but we can't verify it
                    evidenceType,
                    snapshot: null,
                    error: 'Repository not found or is private.',
                };
            }
            if (res.status === 403) {
                return {
                    status: 'unavailable',
                    provenanceLevel: 'source_linked',
                    evidenceType,
                    snapshot: null,
                    error: 'GitHub API rate limit exceeded or access forbidden.',
                };
            }
            return {
                status: 'failed',
                provenanceLevel: 'source_linked',
                evidenceType,
                snapshot: null,
                error: `GitHub API error: ${res.statusText}`,
            };
        }
        const data = await res.json();
        const now = new Date().toISOString();
        let snapshot;
        if (parsed.type === 'pull') {
            snapshot = {
                provider: 'github',
                sourceType: 'github_pr',
                sourceUrl: data.html_url || url,
                author: data.user?.login || null,
                state: data.state || null, // 'open', 'closed'
                mergeStatus: data.merged ? 'merged' : 'unmerged',
                sourceTimestamp: data.created_at || null,
                verifiedAt: now,
                raw: {
                    id: data.id,
                    number: data.number,
                    title: data.title,
                    created_at: data.created_at,
                    merged_at: data.merged_at,
                    state: data.state,
                    author: data.user?.login,
                    repo: `${parsed.owner}/${parsed.repo}`,
                }
            };
        }
        else {
            snapshot = {
                provider: 'github',
                sourceType: 'github_commit',
                sourceUrl: data.html_url || url,
                author: data.author?.login || data.commit?.author?.name || null,
                state: 'committed',
                mergeStatus: null,
                sourceTimestamp: data.commit?.author?.date || null,
                verifiedAt: now,
                raw: {
                    sha: data.sha,
                    message: data.commit?.message,
                    author: data.author?.login || data.commit?.author?.name,
                    date: data.commit?.author?.date,
                    verified: data.commit?.verification?.verified,
                    repo: `${parsed.owner}/${parsed.repo}`,
                }
            };
        }
        return {
            status: 'verified',
            provenanceLevel: 'source_verified',
            evidenceType,
            snapshot,
        };
    }
    catch (error) {
        return {
            status: 'unavailable',
            provenanceLevel: 'source_linked',
            evidenceType,
            snapshot: null,
            error: `Verification failed: ${error.message}`,
        };
    }
}
