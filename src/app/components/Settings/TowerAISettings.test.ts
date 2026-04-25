import assert from 'node:assert/strict'
import test from 'node:test'

import { getTowerAIModelsForProvider } from '~app/bots/towerai/models'

import { normalizeTowerAIModelForProvider } from './TowerAISettings.helpers'

test('keeps a curated TowerAI model after trimming whitespace', () => {
  assert.equal(normalizeTowerAIModelForProvider(' gemini-2.5-pro ', 'gemini'), 'gemini-2.5-pro')
})

test('falls back to the first curated model for the selected TowerAI provider', () => {
  assert.equal(
    normalizeTowerAIModelForProvider('not-in-curated-list', 'claude'),
    getTowerAIModelsForProvider('claude')[0].value,
  )
})
