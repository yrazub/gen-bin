import { MARKETPLACE, REPO } from '../constants';
import type { ArtifactType } from '../catalog/types';

export const MARKETPLACE_ADD = `/plugin marketplace add ${REPO}`;

/** Every artifact installs through its parent plugin (AC-5, AC-6). */
export const installCommand = (plugin: string): string => `/plugin install ${plugin}@${MARKETPLACE}`;
export const shellInstallCommand = (plugin: string): string => `claude plugin install ${plugin}@${MARKETPLACE}`;

export const TYPE_LABELS: Record<ArtifactType, string> = {
  plugin: 'Plugin',
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  hook: 'Hook',
  mcp: 'MCP server',
};

export type FilterType = 'all' | ArtifactType;

export const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plugin', label: 'Plugins' },
  { value: 'skill', label: 'Skills' },
  { value: 'agent', label: 'Agents' },
  { value: 'command', label: 'Commands' },
  { value: 'hook', label: 'Hooks' },
  { value: 'mcp', label: 'MCP servers' },
];

export const isFilterType = (v: string | null): v is FilterType => FILTER_TYPES.some((f) => f.value === v);
