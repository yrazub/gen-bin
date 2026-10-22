import type { Artifact, ArtifactType, Plugin } from '../catalog/types';
import { sourceUrl } from '../repo';
import { url } from '../url';
import { installCommand } from './invocable';

/** The slim record the search page renders a card from. */
export interface SearchCard {
  id: number;
  type: ArtifactType;
  name: string;
  invocable: string;
  plugin: string;
  description: string;
  version: string;
  install: string;
  pluginHref: string;
  sourceHref: string;
}

export const DESCRIPTION_LIMIT = 200;

/** EC-7: a card shows the first 200 characters; the plugin page shows the rest. */
export function truncate(text: string, limit = DESCRIPTION_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

export function makeCard(id: number, a: Artifact, plugin: Plugin | undefined, sha: string): SearchCard {
  let sourceHref: string;
  if (a.type === 'plugin' && plugin?.source.kind === 'external' && plugin.source.link) {
    sourceHref = plugin.source.link;
  } else {
    sourceHref = sourceUrl(a.file, a.type === 'plugin' && plugin?.source.kind === 'local' ? 'tree' : 'blob', sha);
  }
  return {
    id,
    type: a.type,
    name: a.name,
    invocable: a.invocable,
    plugin: a.plugin,
    description: truncate(a.description),
    version: a.version,
    install: installCommand(a.plugin),
    pluginHref: url(`plugins/${a.plugin}/`),
    sourceHref,
  };
}
