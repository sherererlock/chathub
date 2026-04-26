import assert from 'node:assert/strict'
import test from 'node:test'

import { canSubmitChatMessage } from './chat-message-input'

test('canSubmitChatMessage allows image-only submissions', () => {
  const image = new File(['png-bytes'], 'tower.png', { type: 'image/png' })

  assert.equal(canSubmitChatMessage('', image), true)
  assert.equal(canSubmitChatMessage('   ', image), true)
})

test('canSubmitChatMessage allows text-only submissions', () => {
  assert.equal(canSubmitChatMessage('hello'), true)
  assert.equal(canSubmitChatMessage('  hello  '), true)
})

test('canSubmitChatMessage rejects empty submissions without text or image', () => {
  assert.equal(canSubmitChatMessage(''), false)
  assert.equal(canSubmitChatMessage('   '), false)
})
