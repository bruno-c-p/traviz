---
name: react-dry
description: >
  React DRY: detect duplication in components, hooks, and JSX before writing or refactoring.
  Three identical structures in separate contexts triggers extraction.
  Fire when writing new React code, reviewing React changes, or refactoring components and hooks.
user-invocable: false
---

# React DRY

Detect duplication, extract when the Rule of Three is met, resist premature abstraction.

## Steps

### 1. Scan

Search the files being touched and their neighbours for structural repetition: identical or near-identical JSX trees, the same hook logic in multiple components, the same stateful pattern copied between files.

Scope the scan to the feature area in play. Do not audit the whole codebase — focus on the files you are about to write or modify and their immediate imports.

Completion criterion: a list of repetition candidates, each with the file locations where it appears.

### 2. Threshold

For each candidate, verify it appears in **three or more distinct call sites** — different components, different render paths, or different hooks. Same code in one component used in multiple places within that same component does not count: the duplication must cross a context boundary.

Two instances are a maybe. One instance is nothing. Three is the floor.

Completion criterion: every candidate classified as below threshold (leave as-is) or at/above threshold (proceed to evaluation).

### 3. Evaluate

For each candidate at threshold, decide whether extraction earns its complexity:

- **Naming test** — can you name the extracted piece in one word or a short phrase? If you need a sentence, the concept is not yet sharp enough to abstract.
- **Interface test** — does extraction reduce the call site to a clearly better form? If the extracted version is as verbose as the inline version, indirection buys nothing.
- **Context test** — are the call sites genuinely similar, or do they just happen to share structure now and diverge later? Premature abstraction locks in a shape before the shape is known.

All three must pass. If any fails, leave the duplication inline and revisit when more instances appear.

Completion criterion: each candidate classified as extract or defer, with a reason.

### 4. Extract

Choose the pattern that matches the duplication type. See [reference/patterns.md](reference/patterns.md) for concrete implementations.

| Duplication type        | Pattern to extract        |
| ----------------------- | ------------------------- |
| Identical JSX structure | Component                 |
| Repeated hook logic     | Custom hook               |
| Same utility function   | Shared function in `lib/` |
| Shared type definitions | Shared type in `types/`   |

After extraction, every call site must use the new piece. No leftover inline copies.

Completion criterion: the duplication exists in exactly one place, and all former call sites reference it.

### 5. Validate

Run the type checker and linter. Then check each call site: does it still render the same output and behave the same way? If extraction changed the interface or narrowed the props, update the call sites to match.

Completion criterion: `pnpm typecheck` and `pnpm lint` pass with no new errors, and each former call site is verified against the original behaviour.

## Reference

### Decision framework

Extraction earns its complexity when all three conditions hold:

1. **Rule of Three met** — three or more distinct call sites share the structure.
2. **Nameable concept** — the piece has a clear, short name that describes what it does, not how it works.
3. **Call sites improve** — using the extracted piece is unambiguously better than the inline version.

When one condition fails, defer. The duplication is a signal, not a sentence — revisit when the codebase gives you more data.

### Extraction patterns

See [reference/patterns.md](reference/patterns.md) for concrete code: component extraction, hook extraction, utility extraction, type extraction, and the composition patterns that replace prop drilling.

### Premature abstraction warning signs

The abstraction is premature when:

- The extracted piece has **fewer than three** call sites.
- You need a **generic name** like `SharedThing` or `CommonWrapper` because the concept resists a specific name.
- Call sites pass **different props that happen to match today** but will diverge as the feature grows.
- The extraction exists because two pages "look the same" rather than because they **behave the same**.
- You are extracting to follow a rule ("always extract duplication") rather than because the codebase demands it.

When you see these signs, leave the duplication inline. The Rule of Three is a threshold, not a target — meet it, do not chase it.
