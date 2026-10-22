import MiniSearch from 'minisearch';
import type { ArtifactType } from '../lib/catalog/types';
import { highlightParts, queryTerms, type Part } from '../lib/search/highlight';
import { FILTER_TYPES, isFilterType, TYPE_LABELS, type FilterType } from '../lib/search/invocable';
import { miniSearchOptions } from '../lib/search/options';
import type { SearchCard } from '../lib/search/card';
import { notifyChange } from '../lib/team/selection';

interface Loaded {
  ms: MiniSearch;
  cards: SearchCard[];
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 150;
const MAX_QUERY = 200;

const app = document.getElementById('search-app');
if (app) init(app);

function init(app: HTMLElement): void {
  const form = app.querySelector<HTMLFormElement>('[data-search-form]')!;
  const input = form.querySelector<HTMLInputElement>('#q')!;
  const chips = [...form.querySelectorAll<HTMLButtonElement>('[data-chip]')];
  const status = app.querySelector<HTMLElement>('[data-status]')!;
  const grid = app.querySelector<HTMLElement>('[data-grid]')!;
  const noMatches = app.querySelector<HTMLElement>('[data-no-matches]')!;
  const noMatchesText = app.querySelector<HTMLElement>('[data-no-matches-text]')!;
  const template = app.querySelector<HTMLTemplateElement>('#card-template')!;
  const indexUrl = app.dataset.indexUrl!;

  form.hidden = false;
  form.addEventListener('submit', (e) => e.preventDefault());

  const params = new URLSearchParams(location.search);
  const typeParam = params.get('type');
  const state: { q: string; type: FilterType } = {
    q: (params.get('q') ?? '').slice(0, MAX_QUERY),
    type: isFilterType(typeParam) ? typeParam : 'all',
  };
  input.value = state.q;

  let loading: Promise<Loaded> | undefined;
  const load = (): Promise<Loaded> =>
    (loading ??= fetch(indexUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => ({ ms: MiniSearch.loadJS(data.index, miniSearchOptions), cards: data.cards as SearchCard[] })));

  const typeNoun = (t: FilterType) => (t === 'all' ? 'plugins' : FILTER_TYPES.find((f) => f.value === t)!.label.toLowerCase());

  async function run(): Promise<void> {
    let loaded: Loaded;
    try {
      loaded = await load();
    } catch {
      loading = undefined;
      status.textContent = 'Search could not be loaded. Reload the page to try again.';
      return;
    }
    const { ms, cards } = loaded;
    const q = state.q.trim();
    const hasQuery = q.length >= MIN_QUERY;

    // Every artifact the query matches, best first; an empty query matches everything.
    const matched: SearchCard[] = hasQuery ? ms.search(q).map((r) => cards[r.id]) : cards;
    const counts = new Map<string, number>([['all', matched.length]]);
    for (const c of matched) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    for (const chip of chips) {
      chip.querySelector('[data-chip-count]')!.textContent = String(counts.get(chip.dataset.chip!) ?? 0);
      chip.setAttribute('aria-pressed', String(chip.dataset.chip === state.type));
    }

    // With no query, All shows one card per plugin (AC-9).
    const shown = hasQuery
      ? state.type === 'all' ? matched : matched.filter((c) => c.type === state.type)
      : matched.filter((c) => c.type === (state.type === 'all' ? 'plugin' : state.type));

    const terms = hasQuery ? queryTerms(q) : [];
    grid.replaceChildren(...shown.map((card) => render(template, card, terms)));
    notifyChange();

    const empty = hasQuery && shown.length === 0;
    noMatches.hidden = !empty;
    if (empty) noMatchesText.textContent = `No matches for "${q}"`;
    status.textContent = hasQuery
      ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'} for "${q}"`
      : `Showing all ${shown.length} ${typeNoun(state.type)}`;
  }

  function writeUrl(): void {
    const next = new URLSearchParams();
    if (state.q || state.type !== 'all') {
      next.set('q', state.q);
      next.set('type', state.type);
    }
    const query = next.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }

  let timer: number | undefined;
  input.addEventListener('focus', () => void load().catch(() => {}), { once: true });
  input.addEventListener('input', () => {
    state.q = input.value.slice(0, MAX_QUERY);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      writeUrl();
      void run();
    }, DEBOUNCE_MS);
  });
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      state.type = chip.dataset.chip as FilterType;
      writeUrl();
      void run();
    });
  }
  app.querySelector('[data-clear]')!.addEventListener('click', () => {
    state.q = '';
    state.type = 'all';
    input.value = '';
    writeUrl();
    void run();
    input.focus();
  });

  // Counts and chip state only need the index; fetch it now when the URL asks for a search (AC-35).
  if (state.q || state.type !== 'all') void run();
}

/** Clones the page's card template and fills it with text, never markup. */
function render(template: HTMLTemplateElement, card: SearchCard, terms: string[]): Node {
  const el = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
  const part = (name: string) => el.querySelector<HTMLElement>(`[data-f="${name}"]`)!;

  const badge = el.querySelector<HTMLElement>('.badge')!;
  badge.dataset.type = card.type;
  badge.textContent = TYPE_LABELS[card.type as ArtifactType];

  part('in').hidden = card.type === 'plugin';
  const pluginLink = part('plugin-link') as HTMLAnchorElement;
  pluginLink.href = card.pluginHref;
  pluginLink.textContent = card.plugin;

  part('version').textContent = card.version === 'unversioned' ? card.version : `v${card.version}`;

  const name = part('name') as HTMLAnchorElement;
  name.href = card.pluginHref;
  name.replaceChildren(...marks(highlightParts(card.name, terms)));

  part('invocable').textContent = card.invocable;
  part('description').replaceChildren(...marks(highlightParts(card.description, terms)));
  (part('source') as HTMLAnchorElement).href = card.sourceHref;
  el.querySelector<HTMLElement>('[data-team-toggle]')!.dataset.teamToggle = card.type === 'plugin' ? card.plugin : '';

  el.querySelector('code')!.textContent = card.install;
  const copy = el.querySelector<HTMLButtonElement>('button[data-copy]')!;
  copy.dataset.copy = card.install;
  return el;
}

/** Text nodes and <mark> elements built from the parts' text. */
function marks(parts: Part[]): Node[] {
  return parts.map((p) => {
    if (!p.hit) return document.createTextNode(p.text);
    const m = document.createElement('mark');
    m.textContent = p.text;
    return m;
  });
}
