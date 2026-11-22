import { isValidGithubLogin } from './githubProfile'

export function validateWaitlistInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request' } as const
  const body = input as Record<string, unknown>
  if (typeof body.email !== 'string' || body.email.length > 320) return { ok: false, error: 'Enter a valid email address' } as const
  const email = body.email.trim().toLowerCase()
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) || email.split('@')[0].length > 64 || email.startsWith('.') || email.includes('..') || email.includes('.@')) {
    return { ok: false, error: 'Enter a valid email address' } as const
  }
  let github_username: string | null = null
  if (body.github_username !== undefined && body.github_username !== null) {
    if (typeof body.github_username !== 'string' || !isValidGithubLogin(body.github_username)) return { ok: false, error: 'Invalid GitHub username' } as const
    github_username = body.github_username.toLowerCase()
  }
  if (body.source !== 'profile' && body.source !== 'resume') return { ok: false, error: 'Invalid source' } as const
  return { ok: true, value: { email, github_username, source: body.source } } as const
}
