export const STORAGE_KEY = 'gen-bin:team';
export const TEAM_EVENT = 'gen-bin:team-change';
const MAX_NAMES = 200;

/** Splits a `?plugins=a,b` value into names. */
export function parseNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_NAMES);
}

/** Matches names against the catalog; what does not match is reported, never trusted (EC-11, EC-15). */
export function matchKnown(names: string[], known: string[]): { selected: string[]; unknown: string[] } {
  const set = new Set(known);
  return { selected: names.filter((n) => set.has(n)), unknown: names.filter((n) => !set.has(n)) };
}

/** What a stored value means: a JSON array of names, and nothing else. */
export function parseStored(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : [];
  } catch {
    return [];
  }
}

// Kept when storage is blocked, so the selection lasts while the page is open (EC-15).
let memory: string[] | undefined;

export function loadSelection(known: string[]): string[] {
  let names: string[];
  try {
    names = parseStored(localStorage.getItem(STORAGE_KEY));
  } catch {
    names = memory ?? [];
  }
  return matchKnown(names, known).selected;
}

export function saveSelection(names: string[]): void {
  memory = names;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // storage blocked: `memory` carries the selection
  }
}

/** The plugin names the server put on the header's count badge. */
export function knownPlugins(): string[] {
  const el = document.querySelector<HTMLElement>('[data-team-count]');
  return (el?.dataset.known ?? '').split(',').filter(Boolean);
}

export function notifyChange(): void {
  document.dispatchEvent(new CustomEvent(TEAM_EVENT));
}
