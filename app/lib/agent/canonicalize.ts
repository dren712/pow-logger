/**
 * Strict Deterministic Canonical Serialization for PROVN Agent Protocol.
 * 
 * Ensures that payloads are serialized into exactly the same byte sequence
 * across different languages and environments before hashing.
 * 
 * Rules:
 * - null: "null"
 * - boolean: "true" or "false"
 * - number: standard string representation (finite only, NaN/Infinity throw)
 * - string: JSON stringified (handles Unicode and escaping deterministically)
 * - array: "[" + items + "]"
 * - object: "{" + sorted_keys(k + ":" + v) + "}"
 * - undefined, functions, symbols: ignored in objects, translated to null in arrays (standard JSON behavior)
 */

export function canonicalize(val: unknown): string {
  if (val === null) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) throw new Error('Non-finite numbers (NaN, Infinity) are not supported in canonical payloads')
    // Mitigate -0 vs 0 issues
    if (val === 0) return '0'
    return String(val)
  }
  if (typeof val === 'string') {
    return JSON.stringify(val)
  }
  if (Array.isArray(val)) {
    const items = val.map(v => {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return 'null'
      return canonicalize(v)
    })
    return `[${items.join(',')}]`
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    // Note: Dates and other complex objects should be serialized to primitives by the caller.
    // For safety, if it has a toJSON method, use it first.
    if (typeof (obj as { toJSON?: () => unknown }).toJSON === 'function') {
      return canonicalize((obj as { toJSON: () => unknown }).toJSON())
    }

    const keys = Object.keys(obj).sort()
    const items: string[] = []
    
    for (const key of keys) {
      const v = obj[key]
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
        continue // Skip undefined/functions in objects
      }
      items.push(`${JSON.stringify(key)}:${canonicalize(v)}`)
    }
    
    return `{${items.join(',')}}`
  }

  throw new Error(`Unsupported type for canonicalization: ${typeof val}`)
}
