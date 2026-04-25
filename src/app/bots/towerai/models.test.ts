import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_TOWERAI_MODEL,
  DEFAULT_TOWERAI_PROVIDER,
  TOWERAI_COMMON_MODELS,
  findTowerAIProviderByModel,
  getTowerAIModelsForProvider,
  resolveTowerAIModel,
} from './models'

test('custom TowerAI model overrides curated provider/model selection', () => {
  assert.equal(resolveTowerAIModel('gpt-4.1', 'claude-sonnet-4-6'), 'claude-sonnet-4-6')
})

test('falls back to first curated model when saved model is missing', () => {
  assert.equal(resolveTowerAIModel('', ''), DEFAULT_TOWERAI_MODEL)
})

test('finds the provider for a stored curated model id', () => {
  assert.equal(findTowerAIProviderByModel('gemini-2.5-pro'), 'gemini')
})

test('returns the default provider when a stored model id is unknown', () => {
  assert.equal(findTowerAIProviderByModel('not-in-curated-list'), DEFAULT_TOWERAI_PROVIDER)
})

test('keeps flat curated model export for the pre-selector settings UI', () => {
  assert.equal(TOWERAI_COMMON_MODELS[0].value, DEFAULT_TOWERAI_MODEL)
  assert.ok(TOWERAI_COMMON_MODELS.some((item) => item.value === 'claude-sonnet-4-6'))
})

test('maps legacy Claude model ids back to the Claude provider', () => {
  assert.equal(findTowerAIProviderByModel('claude-sonnet-4.5'), 'claude')
  assert.equal(findTowerAIProviderByModel('claude-3.7-sonnet'), 'claude')
})

test('canonicalizes legacy Claude model ids before sending TowerAI requests', () => {
  assert.equal(resolveTowerAIModel('claude-sonnet-4.5', ''), 'claude-sonnet-4-5-20250929')
  assert.equal(resolveTowerAIModel('claude-3.7-sonnet', ''), 'claude-3-7-sonnet-20250219')
})

test('falls back to the default curated model when the saved TowerAI model is unknown', () => {
  assert.equal(resolveTowerAIModel('not-in-curated-list', ''), DEFAULT_TOWERAI_MODEL)
})

test('returns exactly five curated models for each first-release provider', () => {
  assert.equal(getTowerAIModelsForProvider('gpt').length, 5)
  assert.equal(getTowerAIModelsForProvider('claude').length, 5)
  assert.equal(getTowerAIModelsForProvider('gemini').length, 5)
  assert.equal(getTowerAIModelsForProvider('deepseek').length, 5)
  assert.equal(getTowerAIModelsForProvider('qwen').length, 5)
})
