export function newId(prefix = 'id'): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  const rand =
    g.crypto && typeof g.crypto.randomUUID === 'function'
      ? g.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}_${rand}`
}
