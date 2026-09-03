import { canonicalize } from '../app/lib/agent/canonicalize'
import assert from 'assert'

console.log('Testing Canonical Serialization...')

assert.strictEqual(canonicalize(null), 'null')
assert.strictEqual(canonicalize(true), 'true')
assert.strictEqual(canonicalize(false), 'false')
assert.strictEqual(canonicalize(42), '42')
assert.strictEqual(canonicalize(3.14159), '3.14159')
assert.strictEqual(canonicalize(-0), '0')
assert.strictEqual(canonicalize("hello"), '"hello"')
assert.strictEqual(canonicalize("unicode 🚀"), '"unicode 🚀"')

const obj1 = { b: 2, a: 1, c: { z: 9, y: 8 } }
const obj2 = { c: { y: 8, z: 9 }, a: 1, b: 2 }

const can1 = canonicalize(obj1)
const can2 = canonicalize(obj2)

assert.strictEqual(can1, '{"a":1,"b":2,"c":{"y":8,"z":9}}')
assert.strictEqual(can1, can2)

const arr = [3, { b: 2, a: 1 }, null, "test"]
assert.strictEqual(canonicalize(arr), '[3,{"a":1,"b":2},null,"test"]')

assert.throws(() => canonicalize(NaN), /Non-finite numbers/)
assert.throws(() => canonicalize(Infinity), /Non-finite numbers/)

const objWithUndefined = { a: 1, b: undefined, c: 3 }
assert.strictEqual(canonicalize(objWithUndefined), '{"a":1,"c":3}')

const arrWithUndefined = [1, undefined, 3]
assert.strictEqual(canonicalize(arrWithUndefined), '[1,null,3]')

console.log('✅ Canonicalization tests passed.')
