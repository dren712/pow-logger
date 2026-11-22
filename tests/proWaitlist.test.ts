import assert from 'assert'
import { validateWaitlistInput } from '../app/lib/proWaitlist'

console.log('Testing Pro waitlist validation...')
const input = { email: '  Builder+Pro@Example.COM  ', github_username: 'Octo-Cat', source: 'profile' }
assert.deepStrictEqual(validateWaitlistInput(input), {
  ok: true, value: { email: 'builder+pro@example.com', github_username: 'octo-cat', source: 'profile' },
})
assert.deepStrictEqual(validateWaitlistInput({ email: 'a@example.co.uk', source: 'resume' }), {
  ok: true, value: { email: 'a@example.co.uk', github_username: null, source: 'resume' },
})
assert.ok(validateWaitlistInput({ ...input, github_username: null }).ok)
console.log('  ✓ normalized email, optional username and allowed sources')
for (const email of ['', '  ', 'a@b', 'a b@example.com', 'a@@example.com', '.a@example.com', 'a.@example.com', 'a..b@example.com', 'a@-example.com', 'a@example-.com', 'a@ex_ample.com', 'a@example.com\nBcc: x@y.com', `${'a'.repeat(65)}@example.com`, 'a'.repeat(321), `a@${'a'.repeat(250)}.com`, 123, null]) {
  assert.strictEqual(validateWaitlistInput({ ...input, email }).ok, false, `accepted email: ${email}`)
}
for (const github_username of ['', '-octo', 'octo-', 'octo--cat', 'a'.repeat(40), 'a/b', 'octo cat', 42]) {
  assert.strictEqual(validateWaitlistInput({ ...input, github_username }).ok, false)
}
for (const source of ['', 'PROFILE', 'checkout', '../resume', 'a'.repeat(100), undefined, null, 1]) {
  assert.strictEqual(validateWaitlistInput({ ...input, source }).ok, false)
}
for (const body of [null, undefined, [], 'email', 42, {}, { source: 'profile' }]) {
  assert.strictEqual(validateWaitlistInput(body).ok, false)
}
console.log('  ✓ empty/malformed bodies, invalid emails, usernames and sources rejected')
console.log('Pro waitlist validation tests passed.')
