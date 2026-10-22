export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';

export interface Artifact {
  type: ArtifactType;
  name: string;
  /** Name of the parent plugin (the plugin's own name for a plugin). */
  plugin: string;
  /** For a hook, the command text: hooks have no description field. */
  description: string;
  /** `/<plugin>:<skill>`, `@agent-<plugin>:<agent>`, `<plugin>@<marketplace>`, `<Event> · <matcher>`. */
  invocable: string;
  /** Repo-relative path of the source file, posix separators. */
  file: string;
  /** Body text, capped at BODY_LIMIT characters. */
  body: string;
  tags: string[];
  /** Parent plugin's version, or "unversioned". */
  version: string;
  tools?: string[];
  model?: string;
  event?: string;
  matcher?: string;
  command?: string;
  url?: string;
}

export interface Dependency {
  name: string;
  version?: string;
}

export type PluginSource =
  | { kind: 'local'; dir: string }
  | { kind: 'external'; type: string; link?: string };

export interface HookEntry {
  event: string;
  matcher?: string;
  command: string;
  file: string;
}

export interface McpEntry {
  name: string;
  command?: string;
  url?: string;
  file: string;
}

export interface AgentEntry {
  name: string;
  tools: string[];
  model?: string;
}

/** What a plugin executes or connects to (AC-17, AC-18). */
export interface RunsPanel {
  /** False for a plugin whose files are not in this repository (EC-6). */
  inspectable: boolean;
  hooks: HookEntry[];
  mcpServers: McpEntry[];
  bin: string[];
  agents: AgentEntry[];
}

export interface Plugin {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  tags: string[];
  dependencies: Dependency[];
  source: PluginSource;
  /** File that holds the plugin's description: plugin.json, or marketplace.json without one. */
  file: string;
  /** Raw README Markdown, when the plugin has one. */
  readme?: string;
  /** The plugin's own components, without the plugin artifact itself. */
  components: Artifact[];
  runs: RunsPanel;
}

export interface ReleaseSection {
  heading: string;
  items: string[];
}

export interface Release {
  plugin: string;
  version: string;
  /** ISO date (YYYY-MM-DD) of the commit that added the heading, or null for "Unreleased". */
  date: string | null;
  sections: ReleaseSection[];
  /** The entry's Markdown, without its `## ` heading. */
  body: string;
}

export interface Catalog {
  marketplace: string;
  plugins: Plugin[];
  /** One entry per plugin, then every component, in catalog order. */
  artifacts: Artifact[];
  /** Newest first; Unreleased entries lead. */
  releases: Release[];
  warnings: string[];
}

export const BODY_LIMIT = 2000;
