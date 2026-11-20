/** "Lagu yang disukai" → ["Lagu yang", "disukai"]: titles set the last word in italic accent. */
export function splitLastWord(text: string): [string, string] {
  const t = text.trim()
  const at = t.lastIndexOf(' ')
  if (at === -1) return ['', t]
  return [t.slice(0, at).trimEnd(), t.slice(at + 1)]
}
