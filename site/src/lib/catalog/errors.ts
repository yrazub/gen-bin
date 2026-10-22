export class CatalogError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'CatalogError';
  }
}

/** Every problem found in one run, so a build reports them all at once. */
export class CatalogFailure extends Error {
  constructor(readonly errors: CatalogError[]) {
    super(`Catalog has ${errors.length} error(s):\n${errors.map((e) => `  - ${e.message}`).join('\n')}`);
    this.name = 'CatalogFailure';
  }
}
