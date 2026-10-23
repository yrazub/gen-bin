# Tests by layer

The payoff of the onion is that each layer can be tested with exactly the doubles it needs. Suite
layout, file naming and CI are defined by the project's own testing document. Read it before adding a test. This file
only maps layers to test kinds.

| Layer | Test kind | Doubles | Suffix / suite |
|---|---|---|---|
| Domain (`domain.ts`, shared-package rules, engine pure functions) | plain unit: values in, values out | **none** | unit suite, hermetic |
| Application (`service.ts`) | unit with fake ports | in-memory `DigestStore`, `MockLLMProvider`, `MockGitHubClient` | unit suite, hermetic |
| Repository | integration against real Postgres | none (testcontainers) | integration suite |
| Route | `app.inject` through the app factory with overrides | adapter mocks via `overrides` | `*.test.ts` if no DB, else integration suite |
| Adapter | contract test of the translation (SDK response → port type, SDK error → `AppError`) | the SDK's HTTP stubbed, never the network | unit suite |

Rules:
- **A domain test that needs a mock is a smell.** The function is doing I/O and belongs in the
  service (*Functional Core, Imperative Shell*).
- **Fake ports, not `vi.mock` of modules.** A service with narrow dependencies takes a hand-written
  fake. `vi.mock('../repository.js')` is what you reach for when a service hides its
  dependencies, and it shows the service needs `di-narrow-deps`.
- **Don't unit-test a repository with a mocked Drizzle.** It tests nothing but your mock. Use
  an integration test.
- No keys and no network in any test (the project's rules say the same).

Further reading: Gary Bernhardt, [Boundaries](https://www.destroyallsoftware.com/talks/boundaries).
