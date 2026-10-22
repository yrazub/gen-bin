import MiniSearch from 'minisearch';
import type { Catalog } from '../catalog/types';
import { makeCard, type SearchCard } from './card';
import { miniSearchOptions, type SearchDoc } from './options';

export interface SearchData {
  /** `MiniSearch.toJSON()`, loaded in the browser with `MiniSearch.loadJS`. */
  index: ReturnType<MiniSearch['toJSON']>;
  /** Indexed by document id, in catalog order. */
  cards: SearchCard[];
}

export function buildSearchData(catalog: Catalog, sha: string): SearchData {
  const plugins = new Map(catalog.plugins.map((p) => [p.name, p]));
  const ms = new MiniSearch<SearchDoc>(miniSearchOptions);
  const cards: SearchCard[] = [];
  catalog.artifacts.forEach((a, id) => {
    ms.add({ id, name: a.name, description: a.description, tags: a.tags.join(' '), plugin: a.plugin, body: a.body });
    cards.push(makeCard(id, a, plugins.get(a.plugin), sha));
  });
  return { index: ms.toJSON(), cards };
}
