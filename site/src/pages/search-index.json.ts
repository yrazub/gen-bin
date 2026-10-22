import type { APIRoute } from 'astro';
import { loadCatalog } from '../lib/catalog';
import { commitSha } from '../lib/repo';
import { buildSearchData } from '../lib/search/build';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(buildSearchData(loadCatalog(), commitSha())), {
    headers: { 'Content-Type': 'application/json' },
  });
