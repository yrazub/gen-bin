const EDIT = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
const SHELL = ['Bash'];
const WEB = ['WebSearch', 'WebFetch'];

export interface ToolSummary {
  edit: boolean;
  shell: boolean;
  web: boolean;
}

/** An agent without a `tools` list inherits every tool. */
export function toolSummary(tools: string[]): ToolSummary {
  if (!tools.length) return { edit: true, shell: true, web: true };
  const has = (names: string[]) => tools.some((t) => names.includes(t));
  return { edit: has(EDIT), shell: has(SHELL), web: has(WEB) };
}

/** "4 agents can edit files · 4 can run shell commands · 1 can use the web" (design). */
export function summarizeAgents(agents: { tools: string[] }[]): string {
  const sums = agents.map((a) => toolSummary(a.tools));
  const parts: [number, string][] = [
    [sums.filter((s) => s.edit).length, 'edit files'],
    [sums.filter((s) => s.shell).length, 'run shell commands'],
    [sums.filter((s) => s.web).length, 'use the web'],
  ];
  const present = parts.filter(([n]) => n > 0);
  if (!present.length) return 'No agent can edit files, run shell commands or use the web.';
  return present
    .map(([n, what], i) => (i === 0 ? `${n} ${n === 1 ? 'agent' : 'agents'} can ${what}` : `${n} can ${what}`))
    .join(' · ');
}
