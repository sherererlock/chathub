import assert from 'node:assert/strict'
import test from 'node:test'

import { getTowerAIModelsForProvider } from '~app/bots/towerai/models'

import { normalizeTowerAIModelForProvider } from './TowerAISettings.helpers'

test('keeps a curated TowerAI model after trimming whitespace', () => {
  assert.equal(normalizeTowerAIModelForProvider(' gemini-2.5-pro ', 'gemini'), 'gemini-2.5-pro')
})

test('maps legacy Claude model ids to the matching curated selector option', () => {
  assert.equal(normalizeTowerAIModelForProvider('claude-sonnet-4.5', 'claude'), 'claude-sonnet-4-5-20250929')
  assert.equal(normalizeTowerAIModelForProvider('claude-3.7-sonnet', 'claude'), 'claude-3-7-sonnet-20250219')
})

test('falls back to the first curated model for the selected TowerAI provider', () => {
  assert.equal(
    normalizeTowerAIModelForProvider('not-in-curated-list', 'claude'),
    getTowerAIModelsForProvider('claude')[0].value,
  )
})
