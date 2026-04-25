import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTowerAIModel, TOWERAI_COMMON_MODELS } from './models'

test('custom TowerAI model overrides curated selection', () => {
  assert.equal(resolveTowerAIModel('gpt-4.1', 'claude-sonnet-4.5'), 'claude-sonnet-4.5')
})

test('falls back to first curated model when saved model is missing', () => {
  assert.equal(resolveTowerAIModel('', ''), TOWERAI_COMMON_MODELS[0].value)
})
