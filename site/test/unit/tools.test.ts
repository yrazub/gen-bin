import { describe, expect, it } from 'vitest';
import { summarizeAgents, toolSummary } from '../../src/lib/tools';

describe('tool summary', () => {
  it('classifies edit, shell and web tools', () => {
    expect(toolSummary(['Read', 'Grep'])).toEqual({ edit: false, shell: false, web: false });
    expect(toolSummary(['Read', 'Edit', 'Bash'])).toEqual({ edit: true, shell: true, web: false });
    expect(toolSummary(['WebFetch'])).toEqual({ edit: false, shell: false, web: true });
  });

  it('treats a missing tools list as every tool', () => {
    expect(toolSummary([])).toEqual({ edit: true, shell: true, web: true });
  });

  it('summarises a set of agents', () => {
    const agents = [{ tools: ['Edit', 'Bash'] }, { tools: ['Read'] }, { tools: ['Write', 'WebFetch'] }];
    expect(summarizeAgents(agents)).toBe('2 agents can edit files · 1 can run shell commands · 1 can use the web');
    expect(summarizeAgents([{ tools: ['Edit'] }])).toBe('1 agent can edit files');
    expect(summarizeAgents([{ tools: ['Read'] }])).toBe('No agent can edit files, run shell commands or use the web.');
  });
});
