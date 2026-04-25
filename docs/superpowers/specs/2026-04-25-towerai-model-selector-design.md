# TowerAI Model Selector Design

**Goal:** Replace the current flat TowerAI model dropdown with a two-step `Provider` + `Model` selector backed by a static curated list.

**Status:** Approved for design drafting, pending user review before implementation planning.

## Context

The current TowerAI settings UI exposes a single flat `Model` dropdown populated from a short handwritten list in `src/app/bots/towerai/models.ts`.

This causes three problems:

- provider identity is hidden, so users cannot quickly narrow the list by family
- the flat list does not scale once more providers are added
- the data shape is not ready for curated per-provider maintenance

The workspace already contains a broader model inventory in `TowerAI/docs/models.md`. That document is suitable as a manual source for curation, but it should not become a runtime dependency of ChatHub.

## Scope

This design covers:

- replacing the single TowerAI model dropdown with two linked selectors
- introducing a static, curated per-provider model catalog in ChatHub code
- keeping only the latest five curated models per provider
- preserving compatibility with existing stored `toweraiModel` values
- preserving `Custom Model ID` override behavior

This design does not cover:

- runtime parsing of `TowerAI/docs/models.md`
- dynamic fetching of model catalogs from TowerAI
- exposing every model from the TowerAI inventory
- changing TowerAI request routing logic
- changing helper auth behavior

## User Experience

The TowerAI settings panel will present model selection as two adjacent or stacked controls:

1. `Provider`
2. `Model`

Expected behavior:

- users first choose a provider such as `GPT`, `Claude`, or `Gemini`
- the `Model` dropdown then shows only the curated five models for that provider
- changing provider automatically selects that provider's default first model
- existing saved model values reopen with the matching provider and model selected
- if a saved model value is no longer in the curated list, the UI falls back to the default provider and its first model
- `Custom Model ID` remains available and continues to override the selected dropdown model at send time

## Chosen Approach

Use a static curated catalog in ChatHub, grouped by provider, and render it through two linked selectors.

This approach is preferred because it:

- keeps the UI predictable and focused
- avoids coupling ChatHub runtime behavior to the separate `TowerAI/` repository
- minimizes implementation risk by preserving existing storage and send semantics
- makes future curation a straightforward code edit instead of a parsing pipeline

## Rejected Alternatives

### Runtime Parsing of `models.md`

Rejected because it creates cross-repository coupling and adds parsing complexity for a problem that only needs a curated shortlist.

### Single Dropdown with Grouped Labels

Rejected because the user explicitly wants `Provider` and `Model` to be selected separately, and a single grouped dropdown still has worse scanability for longer lists.

## Data Model

Replace the flat common-model list with a provider-aware static structure in `src/app/bots/towerai/models.ts`.

Suggested shape:

```ts
interface TowerAIModelOption {
  label: string
  value: string
}

interface TowerAIModelProvider {
  provider: string
  label: string
  models: TowerAIModelOption[]
}
```

Primary exported constants and helpers:

- `TOWERAI_MODEL_PROVIDERS`
- `DEFAULT_TOWERAI_PROVIDER`
- `DEFAULT_TOWERAI_MODEL`
- helper to find provider by model id
- helper to get models for a provider
- existing `resolveTowerAIModel()` kept, with unchanged priority:
  1. `toweraiCustomModel`
  2. selected curated `toweraiModel`
  3. default curated model

## Curated Provider List

First-release providers:

- `GPT`
- `Claude`
- `Gemini`
- `DeepSeek`
- `Qwen`

Providers intentionally excluded from the first release:

- `LLaMA`
- `Mistral`
- `Moonshot`

These excluded groups either have too few entries to justify first-pass UI space or are lower-priority for the initial curated experience.

## Curated Model Selection Rules

Each provider keeps exactly five curated entries in code.

Selection rules:

- prefer newer mainline chat models
- prefer stable models over preview models when both exist
- prefer broadly useful general-text models over specialized image-only, thinking-only, or codex-only variants
- use `TowerAI/docs/models.md` as a manual curation reference, not as a programmatic source

This means the "latest five" set is a deliberate curated shortlist, not an automatic sort at runtime.

## Settings UI Behavior

The current `Model` field in `src/app/components/Settings/TowerAISettings.tsx` will be split into:

- `Provider`
- `Model`

Behavior details:

- the selected provider is derived from the currently saved `toweraiModel`
- if the current model belongs to a known provider, select that provider automatically
- if the current model is unknown, fall back to the default provider
- when provider changes, update `toweraiModel` to the first model in that provider list
- when model changes, update `toweraiModel` as before
- `Custom Model ID` stays visible below the curated selectors

The settings page does not need to persist a separate `toweraiProvider` field. Provider can be derived from `toweraiModel` on render.

This keeps storage changes to a minimum and avoids migration complexity.

## Compatibility Strategy

Existing users may already have one of the old flat-list values stored in `toweraiModel`.

Compatibility rules:

- if stored `toweraiModel` exists in the new curated provider catalog, preselect the matching provider and model
- if it does not exist in the curated provider catalog, use the default provider and default model
- if `toweraiCustomModel` is non-empty, do not change its priority or stored value

No settings migration step is required because the stored shape remains the same.

## Implementation Boundaries

Planned code changes should stay limited to:

- `src/app/bots/towerai/models.ts`
- `src/app/components/Settings/TowerAISettings.tsx`
- TowerAI model-related tests near `src/app/bots/towerai`

No request-path changes are needed in the TowerAI bot transport layer for this work.

## Validation Plan

### Automated Validation

- update model tests for provider-aware helpers
- verify provider lookup from saved model id
- verify fallback to default provider and model for unknown saved values
- verify `resolveTowerAIModel()` still prioritizes `toweraiCustomModel`
- run `yarn test`
- run `yarn build`

### Manual Validation

Required manual checks:

1. open TowerAI settings with an existing curated saved model and confirm both selectors restore correctly
2. switch provider and confirm the model dropdown refreshes to that provider's five entries
3. switch provider and confirm the first model is auto-selected
4. set `Custom Model ID` and confirm it still overrides the dropdown selection during send
5. clear `Custom Model ID` and confirm dropdown selection is used again

## Risks

- manual curation can drift from the full TowerAI catalog over time
- display labels may need occasional cleanup when upstream naming changes
- some seemingly newer models in `models.md` may not actually be enabled for all accounts, so curation should favor broadly accessible models

## Acceptance Criteria

The work is complete when:

- TowerAI settings show separate `Provider` and `Model` selectors
- each first-release provider shows exactly five curated models
- provider switching updates the available model options immediately
- existing curated saved model ids restore to the correct provider and model
- unknown saved model ids fall back safely to defaults
- `Custom Model ID` still overrides curated selection
- `yarn test` passes
- `yarn build` passes
