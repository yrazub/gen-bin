import { CatalogError } from './errors';
import type { Catalog } from './types';

/** A plugin, skill, agent or command without a description would render an empty card (AC-29). */
export function validateCatalog(catalog: Pick<Catalog, 'plugins'>): CatalogError[] {
  const errors: CatalogError[] = [];
  for (const plugin of catalog.plugins) {
    if (!plugin.description) {
      errors.push(new CatalogError(plugin.file, `plugin "${plugin.name}" has no description`));
    }
    for (const a of plugin.components) {
      if ((a.type === 'skill' || a.type === 'agent' || a.type === 'command') && !a.description) {
        errors.push(new CatalogError(a.file, `${a.type} "${a.name}" has no description`));
      }
    }
  }
  return errors;
}
