# TowerAI Model Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TowerAI's flat model dropdown with a static curated `Provider` + `Model` selector while preserving existing `toweraiModel` storage and `Custom Model ID` override behavior.

**Architecture:** Keep the data model centered on the existing stored `toweraiModel` string and derive provider state in the settings UI. Move curated model data in `src/app/bots/towerai/models.ts` from a flat array to a provider-grouped structure with helper functions for provider lookup, default fallback, and model resolution. Update the settings component to render two linked selects without changing TowerAI request transport.

**Tech Stack:** React, TypeScript, Headless UI `Listbox`, `tsx --test`, Chrome Extension sync config

---

## File Structure

- `src/app/bots/towerai/models.ts`: replace the flat curated list with provider-grouped constants and lookup helpers.
- `src/app/bots/towerai/models.test.ts`: cover provider lookup, default fallback, and `Custom Model ID` precedence.
- `src/app/components/Settings/TowerAISettings.tsx`: replace the single model selector with `Provider` and `Model` selectors linked to the same stored `toweraiModel`.
- `docs/superpowers/specs/2026-04-25-towerai-model-selector-design.md`: design reference only; no implementation change needed.

## Task 1: Restructure TowerAI Curated Model Data

**Files:**
- Modify: `src/app/bots/towerai/models.ts`
- Test: `src/app/bots/towerai/models.test.ts`

- [ ] **Step 1: Replace the current tests with failing provider-aware tests**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_TOWERAI_MODEL,
  DEFAULT_TOWERAI_PROVIDER,
  findTowerAIProviderByModel,
  getTowerAIModelsForProvider,
  resolveTowerAIModel,
} from './models'

test('custom TowerAI model overrides curated provider/model selection', () => {
  assert.equal(resolveTowerAIModel('gpt-4.1', 'claude-sonnet-4-6'), 'claude-sonnet-4-6')
})

test('falls back to the default curated model when saved model is missing', () => {
  assert.equal(resolveTowerAIModel('', ''), DEFAULT_TOWERAI_MODEL)
})

test('finds the provider for a stored curated model id', () => {
  assert.equal(findTowerAIProviderByModel('gemini-2.5-pro'), 'gemini')
})

test('returns the default provider when a stored model id is unknown', () => {
  assert.equal(findTowerAIProviderByModel('not-in-curated-list'), DEFAULT_TOWERAI_PROVIDER)
})

test('returns exactly five curated models for each first-release provider', () => {
  assert.equal(getTowerAIModelsForProvider('gpt').length, 5)
  assert.equal(getTowerAIModelsForProvider('claude').length, 5)
  assert.equal(getTowerAIModelsForProvider('gemini').length, 5)
  assert.equal(getTowerAIModelsForProvider('deepseek').length, 5)
  assert.equal(getTowerAIModelsForProvider('qwen').length, 5)
})
```

- [ ] **Step 2: Run the focused test to confirm the new expectations fail**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: FAIL because `DEFAULT_TOWERAI_MODEL`, `DEFAULT_TOWERAI_PROVIDER`, `findTowerAIProviderByModel()`, and `getTowerAIModelsForProvider()` do not exist yet.

- [ ] **Step 3: Replace the flat curated list with provider-grouped constants**

```ts
export type TowerAIProviderId = 'gpt' | 'claude' | 'gemini' | 'deepseek' | 'qwen'

export interface TowerAIModelOption {
  label: string
  value: string
}

export interface TowerAIModelProvider {
  provider: TowerAIProviderId
  label: string
  models: TowerAIModelOption[]
}

export const TOWERAI_MODEL_PROVIDERS: TowerAIModelProvider[] = [
  {
    provider: 'gpt',
    label: 'GPT',
    models: [
      { label: 'GPT-5.2', value: 'gpt-5.2' },
      { label: 'GPT-5.1', value: 'gpt-5.1' },
      { label: 'GPT-5 mini', value: 'gpt-5-mini' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4o', value: 'gpt-4o' },
    ],
  },
  {
    provider: 'claude',
    label: 'Claude',
    models: [
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
      { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
      { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
      { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
      { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
    ],
  },
  {
    provider: 'gemini',
    label: 'Gemini',
    models: [
      { label: 'Gemini 3 Pro Preview', value: 'gemini-3-pro-preview' },
      { label: 'Gemini 3.0 Flash', value: 'gemini-3-flash-preview' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
    ],
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    models: [
      { label: 'DeepSeek V3.2 Thinking', value: 'deepseek-reasoner' },
      { label: 'DeepSeek V3', value: 'deepseek-r1' },
      { label: 'DeepSeek V3.1', value: 'deepseek-v3' },
      { label: 'DeepSeek V3.2', value: 'deepseek-chat' },
      { label: 'DeepSeek V3 0324', value: 'deepseek-v3-0324' },
    ],
  },
  {
    provider: 'qwen',
    label: 'Qwen',
    models: [
      { label: 'Qwen Long', value: 'qwen-long' },
      { label: 'Qwen Max', value: 'qwen-max' },
      { label: 'Qwen Plus', value: 'qwen-plus' },
      { label: 'Qwen Turbo', value: 'qwen-turbo' },
      { label: 'Qwen3 235B A22B', value: 'qwen3-235b-a22b' },
    ],
  },
]

export const DEFAULT_TOWERAI_PROVIDER: TowerAIProviderId = TOWERAI_MODEL_PROVIDERS[0].provider
export const DEFAULT_TOWERAI_MODEL = TOWERAI_MODEL_PROVIDERS[0].models[0].value
```

- [ ] **Step 4: Add provider lookup helpers and keep model resolution semantics unchanged**

```ts
export function getTowerAIModelsForProvider(provider: TowerAIProviderId) {
  return TOWERAI_MODEL_PROVIDERS.find((item) => item.provider === provider)?.models ?? TOWERAI_MODEL_PROVIDERS[0].models
}

export function findTowerAIProviderByModel(model: string): TowerAIProviderId {
  const normalized = model.trim()
  if (!normalized) {
    return DEFAULT_TOWERAI_PROVIDER
  }

  const matchedProvider = TOWERAI_MODEL_PROVIDERS.find((provider) =>
    provider.models.some((item) => item.value === normalized),
  )

  return matchedProvider?.provider ?? DEFAULT_TOWERAI_PROVIDER
}

export function resolveTowerAIModel(selected: string, custom: string) {
  const customModel = custom.trim()
  if (customModel) {
    return customModel
  }

  const curatedModel = selected.trim()
  if (curatedModel) {
    return curatedModel
  }

  return DEFAULT_TOWERAI_MODEL
}
```

- [ ] **Step 5: Re-run the focused model test**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: PASS with all five tests green.

- [ ] **Step 6: Commit the provider-grouped model layer**

```bash
git add src/app/bots/towerai/models.ts src/app/bots/towerai/models.test.ts
git commit -m "feat(towerai): group curated models by provider"
```

## Task 2: Convert TowerAI Settings To Linked Provider And Model Selectors

**Files:**
- Modify: `src/app/components/Settings/TowerAISettings.tsx`

- [ ] **Step 1: Add a failing settings-focused test by extending the model test file with provider defaults**

```ts
test('uses the first model for a provider as the provider default', () => {
  assert.equal(getTowerAIModelsForProvider('claude')[0].value, 'claude-sonnet-4-6')
  assert.equal(getTowerAIModelsForProvider('gpt')[0].value, 'gpt-5.2')
})
```

- [ ] **Step 2: Run the model test again to confirm the expected provider defaults fail before the UI change**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: FAIL if the curated ordering in `models.ts` does not yet match the intended provider-default order.

- [ ] **Step 3: Replace the single `Model` selector imports with provider-aware helpers**

```ts
import {
  DEFAULT_TOWERAI_PROVIDER,
  TOWERAI_MODEL_PROVIDERS,
  findTowerAIProviderByModel,
  getTowerAIModelsForProvider,
  type TowerAIProviderId,
} from '~app/bots/towerai/models'
```

- [ ] **Step 4: Add derived provider state inside `TowerAISettings`**

```ts
const selectedProvider = useMemo<TowerAIProviderId>(
  () => findTowerAIProviderByModel(userConfig.toweraiModel),
  [userConfig.toweraiModel],
)

const providerOptions = useMemo(
  () => TOWERAI_MODEL_PROVIDERS.map((item) => ({ name: item.label, value: item.provider })),
  [],
)

const modelOptions = useMemo(
  () => getTowerAIModelsForProvider(selectedProvider).map((item) => ({ name: item.label, value: item.value })),
  [selectedProvider],
)

const handleProviderChange = useCallback(
  (provider: TowerAIProviderId) => {
    const nextModels = getTowerAIModelsForProvider(provider)
    updateConfigValue({ toweraiModel: nextModels[0]?.value ?? userConfig.toweraiModel })
  },
  [updateConfigValue, userConfig.toweraiModel],
)
```

- [ ] **Step 5: Replace the flat `Model` UI block with linked `Provider` and `Model` controls**

```tsx
<div className="flex flex-col gap-1">
  <p className="font-medium text-sm">Provider</p>
  <Select
    options={providerOptions}
    value={selectedProvider}
    onChange={(v) => handleProviderChange(v as TowerAIProviderId)}
  />
</div>

<div className="flex flex-col gap-1">
  <p className="font-medium text-sm">Model</p>
  <Select
    options={modelOptions}
    value={modelOptions.some((item) => item.value === userConfig.toweraiModel) ? userConfig.toweraiModel : modelOptions[0].value}
    onChange={(v) => updateConfigValue({ toweraiModel: v })}
  />
</div>
```

- [ ] **Step 6: Keep `Custom Model ID` untouched so send-time override semantics do not change**

```tsx
<div className="flex flex-col gap-1">
  <p className="font-medium text-sm">Custom Model ID</p>
  <Input
    placeholder="Optional custom model id"
    value={userConfig.toweraiCustomModel}
    onChange={(e) => updateConfigValue({ toweraiCustomModel: e.currentTarget.value })}
  />
</div>
```

- [ ] **Step 7: Re-run the focused model test and full build**

Run: `yarn test src/app/bots/towerai/models.test.ts`
Expected: PASS with provider-default ordering and lookup tests green.

Run: `yarn build`
Expected: PASS with no TypeScript errors from `TowerAISettings.tsx`.

- [ ] **Step 8: Commit the linked selector UI**

```bash
git add src/app/components/Settings/TowerAISettings.tsx src/app/bots/towerai/models.ts src/app/bots/towerai/models.test.ts
git commit -m "feat(towerai): split model selection into provider and model"
```

## Task 3: Verify Backward Compatibility And Final Behavior

**Files:**
- Modify: none
- Verify: `src/app/bots/towerai/models.ts`, `src/app/components/Settings/TowerAISettings.tsx`

- [ ] **Step 1: Run the complete root test suite**

Run: `yarn test`
Expected: PASS with existing TowerAI helper tests and the updated model tests all green.

- [ ] **Step 2: Run the production build**

Run: `yarn build`
Expected: PASS and the extension bundle includes the updated TowerAI settings UI.

- [ ] **Step 3: Manually verify settings behavior in the built extension**

```text
1. Reload the unpacked ChatHub extension.
2. Open Settings > TowerAI.
3. Confirm the old single Model selector is replaced by Provider and Model.
4. Select Provider = Claude and verify the Model list shows only five Claude entries.
5. Switch Provider = Gemini and verify the selected model changes to the first Gemini entry automatically.
6. Set Custom Model ID to a non-empty value and confirm the field remains editable and visible below the curated selectors.
7. Clear Custom Model ID and verify the selected curated model remains intact.
8. If sync storage still contains an older curated value such as gpt-4.1, reopen Settings and confirm Provider restores to GPT automatically.
```

- [ ] **Step 4: Capture any remaining risks in the handoff**

```text
- Curated provider lists are intentionally static and will need manual refresh when TowerAI model availability changes.
- Some latest models listed in docs may not be enabled for every TowerAI account, so future curation should bias toward broadly accessible models.
- Provider is derived from toweraiModel instead of stored separately; any non-curated saved model id will always display the default provider until the user chooses a curated model again.
```

- [ ] **Step 5: Commit only if verification remains green**

```bash
git status --short
git add src/app/bots/towerai/models.ts src/app/bots/towerai/models.test.ts src/app/components/Settings/TowerAISettings.tsx
git commit -m "test(towerai): verify provider-model selector rollout"
```
