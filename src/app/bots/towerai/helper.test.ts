import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

import { resolveTowerAICredentials } from './helper'

test('manual mode returns sync-stored credentials without calling helper', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('fetch should not be called in manual mode')
  })

  const result = await resolveTowerAICredentials({
    toweraiAuthMode: 'manual',
    toweraiToken: 'token-1',
    toweraiAuthToken: 'auth-1',
    toweraiHelperUrl: 'http://127.0.0.1:21941',
  })

  assert.equal(result.token, 'token-1')
  assert.equal(result.authToken, 'auth-1')
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('helper mode falls back to manual credentials when helper is unavailable', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('helper unavailable')
  })

  const result = await resolveTowerAICredentials({
    toweraiAuthMode: 'helper',
    toweraiToken: 'token-fallback',
    toweraiAuthToken: 'auth-fallback',
    toweraiHelperUrl: 'http://127.0.0.1:21941',
  })

  assert.equal(result.token, 'token-fallback')
  assert.equal(result.authToken, 'auth-fallback')
  assert.equal(fetchMock.mock.callCount(), 1)
})
