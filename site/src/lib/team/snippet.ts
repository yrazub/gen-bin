import { MARKETPLACE, REPO } from '../constants';

export interface TeamPlugin {
  name: string;
  dependencies: { name: string }[];
}

export interface Snippet {
  /** The `.claude/settings.json` snippet, pretty-printed. */
  json: string;
  /** Plugins the snippet enables: the selection plus its gen-bin dependencies, in catalog order. */
  enabled: string[];
  /** For each plugin added only as a dependency, the selected plugins that need it. */
  addedBy: Record<string, string[]>;
  /** Selected names that are not in the catalog (EC-11). */
  unknown: string[];
}

/** "name" or "name@gen-bin" names a plugin of this marketplace; "name@other" does not. */
export function localDependency(dep: string): string | undefined {
  const [name, marketplace] = dep.split('@');
  return !marketplace || marketplace === MARKETPLACE ? name : undefined;
}

export function buildSnippet(selected: string[], plugins: TeamPlugin[]): Snippet {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const picked = [...new Set(selected)];
  const unknown = picked.filter((n) => !byName.has(n));
  const chosen = new Set(picked.filter((n) => byName.has(n)));

  const enabled = new Set(chosen);
  const addedBy: Record<string, string[]> = {};
  for (const root of chosen) {
    const seen = new Set([root]);
    const queue = [root];
    while (queue.length) {
      for (const dep of byName.get(queue.shift()!)!.dependencies) {
        const name = localDependency(dep.name);
        if (!name || seen.has(name) || !byName.has(name)) continue;
        seen.add(name);
        queue.push(name);
        if (chosen.has(name)) continue;
        enabled.add(name);
        (addedBy[name] ??= []).push(root);
      }
    }
  }

  const ordered = plugins.map((p) => p.name).filter((n) => enabled.has(n));
  const json = JSON.stringify(
    {
      extraKnownMarketplaces: { [MARKETPLACE]: { source: { source: 'github', repo: REPO } } },
      enabledPlugins: Object.fromEntries(ordered.map((n) => [`${n}@${MARKETPLACE}`, true])),
    },
    null,
    2,
  );
  return { json, enabled: ordered, addedBy, unknown };
}
