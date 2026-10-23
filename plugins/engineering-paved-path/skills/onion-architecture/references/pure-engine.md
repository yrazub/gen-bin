# A pure engine package

Some projects keep their domain (for example prompt assembly, scoring, or other rules that decide
from data) in a separate package: an **engine**. It is the clearest onion. The domain sits in the
center, the only way out is an injected port (for example an `LLMProvider`), and the server is its
composition root. If the project has no such package, skip this file.

## `core-stays-pure` ✓

- Engine files may import the shared contracts package, `zod` and each other.
- They never import server code (other than the shared contracts) and never an SDK.
- **The exception is the engine's LLM transport folder.** A concrete provider and a structured-output
  helper may ship inside the package as adapters. The pipeline must receive a provider and never
  import the concrete one directly.

## `core-no-node-io` ✓ (except `process.env`)

No `fs`, `child_process`, `net`, `http` or `worker_threads`. dependency-cruiser checks those
imports. It **cannot** see `process.env`, so check reviews for it by hand:
`grep -rn process.env <engine>/src` must print nothing.

Configuration comes in as arguments (a strategy object, model id, limits), resolved by the server
from its config.

## `core-public-api-only` ✓

The server imports the engine through its public entry point (the tsconfig alias for
`src/index.ts`) and nothing deeper. A deep import couples the server to the engine's internal
layout. If the server needs something, export it from `index.ts`.

## Where new engine code goes

| New thing | Place |
|---|---|
| a rule about the engine's results (scores, verdicts) | the engine (pure, with a test and a stubbed provider) |
| a new prompt input | the engine's prompt builder; the **server** gathers the data and passes it in |
| anything that needs the DB, git or an external API to compute | the server gathers it and passes the result as an argument |
| a new LLM transport | an adapter implementing the provider port, in the server's adapters folder, unless every consumer of the engine needs it |

## How this is checked

Run the server's architecture check over the engine's sources as well, if the project has one, and
make sure the CI path filter for that check includes the engine folder.
