import type { Options } from 'minisearch';

/** Shared by the build (indexing) and the browser (loading the index and searching). */
export const miniSearchOptions: Options = {
  idField: 'id',
  fields: ['name', 'description', 'tags', 'plugin', 'body'],
  tokenize: (text) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean),
  searchOptions: {
    boost: { name: 6, description: 3, tags: 2, plugin: 1.5, body: 1 },
    prefix: true,
    fuzzy: (term) => (term.length >= 5 ? 1 : 0),
    combineWith: 'AND',
  },
};

export interface SearchDoc {
  id: number;
  name: string;
  description: string;
  tags: string;
  plugin: string;
  body: string;
}
