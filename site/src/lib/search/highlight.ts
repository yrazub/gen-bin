export interface Part {
  text: string;
  hit: boolean;
}

const WORD = /[\p{L}\p{N}]+/gu;

/** Lowercased query words, split the way the index splits text. */
export function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Splits `text` into plain and matched parts. A word is matched when a query word is a prefix of
 * it, the same prefix rule the search uses (AC-7). The parts are text, never HTML.
 */
export function highlightParts(text: string, terms: string[]): Part[] {
  if (!terms.length) return [{ text, hit: false }];
  const parts: Part[] = [];
  const push = (t: string, hit: boolean) => {
    if (!t) return;
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += t;
    else parts.push({ text: t, hit });
  };
  let at = 0;
  for (const m of text.matchAll(WORD)) {
    const word = m[0].toLowerCase();
    push(text.slice(at, m.index), false);
    push(m[0], terms.some((t) => word.startsWith(t)));
    at = m.index + m[0].length;
  }
  push(text.slice(at), false);
  return parts;
}
