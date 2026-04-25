import assert from 'node:assert/strict'
import test from 'node:test'
import { ChatError, ErrorCode } from '~utils/errors'
import { buildTowerAIUserMessage, type TowerAICredentials } from './api'
import type { TowerAIBotConfig, TowerAIBotDependencies } from './index'

function createConfig(overrides: Partial<TowerAIBotConfig> = {}): TowerAIBotConfig {
  return {
    toweraiBaseUrl: 'https://tower-ai.yottastudios.com',
    toweraiModel: 'gpt-4.1',
    toweraiCustomModel: '',
    toweraiAuthMode: 'helper',
    toweraiHelperUrl: 'http://127.0.0.1:21941',
    toweraiToken: '',
    toweraiAuthToken: '',
    toweraiAutoRefresh: true,
    ...overrides,
  }
}

async function createBot(overrides: Partial<TowerAIBotDependencies> = {}) {
  globalThis.chrome ??= {
    runtime: {
      id: 'towerai-test-extension',
      getManifest: () => ({ version: '0.0.0-test' }),
    },
  } as unknown as typeof chrome

  const { TowerAIBot } = await import('./index')
  const config = createConfig()
  const credentials: TowerAICredentials = { token: 'token-1', authToken: 'auth-1' }

  const deps: TowerAIBotDependencies = {
    getUserConfig: async () => config,
    resolveTowerAIModel: () => 'resolved-model',
    resolveTowerAICredentials: async () => credentials,
    refreshTowerAICredentials: async () => credentials,
    buildTowerAIUserMessage,
    uploadTowerAIImage: async () => {
      throw new Error('uploadTowerAIImage should be mocked for this test')
    },
    requestTowerAIChat: async () => new Response(null, { status: 200 }),
    streamTowerAIResponse: async () => undefined,
    ...overrides,
  }

  return new TowerAIBot(deps)
}

test('TowerAIBot sends text prompts, streams updates, and keeps conversation history', async () => {
  const requests: Array<{ model: string; messages: unknown[] }> = []
  const answers = ['draft answer', 'final answer']
  let streamCallCount = 0
  const bot = await createBot({
    resolveTowerAIModel: (selected, custom) => {
      assert.equal(selected, 'gpt-4.1')
      assert.equal(custom, '')
      return 'resolved-model'
    },
    uploadTowerAIImage: async () => {
      throw new Error('text-only prompts should not upload images')
    },
    requestTowerAIChat: async (options) => {
      requests.push({ model: options.model, messages: options.messages })
      return new Response(null, { status: 200 })
    },
    streamTowerAIResponse: async (_response, onText) => {
      const answer = answers[streamCallCount++]
      onText(answer.slice(0, 5))
      onText(answer)
    },
  })
  const firstEvents: unknown[] = []
  const secondEvents: unknown[] = []

  await bot.doSendMessage({
    prompt: 'first prompt',
    rawUserInput: 'first input',
    onEvent: (event) => firstEvents.push(event),
  })
  await bot.doSendMessage({
    prompt: 'second prompt',
    rawUserInput: 'second input',
    onEvent: (event) => secondEvents.push(event),
  })

  assert.equal(bot.supportsImageInput, true)
  assert.deepEqual(firstEvents, [
    { type: 'UPDATE_ANSWER', data: { text: 'draft' } },
    { type: 'UPDATE_ANSWER', data: { text: 'draft answer' } },
    { type: 'DONE' },
  ])
  assert.deepEqual(secondEvents, [
    { type: 'UPDATE_ANSWER', data: { text: 'final' } },
    { type: 'UPDATE_ANSWER', data: { text: 'final answer' } },
    { type: 'DONE' },
  ])
  assert.deepEqual(requests, [
    {
      model: 'resolved-model',
      messages: [{ role: 'user', content: 'first input' }],
    },
    {
      model: 'resolved-model',
      messages: [
        { role: 'user', content: 'first input' },
        { role: 'assistant', content: 'draft answer' },
        { role: 'user', content: 'second input' },
      ],
    },
  ])
})

test('TowerAIBot uploads images and sends a multimodal user message', async () => {
  const image = new File(['png-bytes'], 'tower.png', { type: 'image/png' })
  const uploadCalls: Array<{ file: File; baseUrl: string; signal?: AbortSignal }> = []
  const requests: Array<unknown[]> = []
  const bot = await createBot({
    uploadTowerAIImage: async (options) => {
      uploadCalls.push(options)
      return {
        fileId: 'file-1',
        url: 'https://cdn.example.com/tower.png',
        mimeType: options.file.type,
        name: options.file.name,
      }
    },
    requestTowerAIChat: async (options) => {
      requests.push(options.messages)
      return new Response(null, { status: 200 })
    },
    streamTowerAIResponse: async (_response, onText) => {
      onText('image answer')
    },
  })
  const events: unknown[] = []

  await bot.doSendMessage({
    prompt: 'normalized prompt',
    rawUserInput: 'describe the uploaded image',
    image,
    onEvent: (event) => events.push(event),
  })

  assert.deepEqual(uploadCalls, [
    {
      baseUrl: 'https://tower-ai.yottastudios.com',
      file: image,
      credentials: { token: 'token-1', authToken: 'auth-1' },
      signal: undefined,
    },
  ])
  assert.deepEqual(requests, [
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'describe the uploaded image' },
          {
            type: 'image_url',
            image_url: { url: 'https://cdn.example.com/tower.png', detail: 'auto' },
          },
        ],
      },
    ],
  ])
  assert.deepEqual(events, [
    { type: 'UPDATE_ANSWER', data: { text: 'image answer' } },
    { type: 'DONE' },
  ])
})

test('TowerAIBot surfaces image upload failures without sending a chat request', async () => {
  const image = new File(['png-bytes'], 'tower.png', { type: 'image/png' })
  const requests: Array<unknown[]> = []
  let streamCallCount = 0
  const bot = await createBot({
    uploadTowerAIImage: async () => {
      throw new ChatError('TowerAI image upload failed', ErrorCode.TOWERAI_REQUEST_FAILED)
    },
    requestTowerAIChat: async (options) => {
      requests.push(options.messages)
      return new Response(null, { status: 200 })
    },
    streamTowerAIResponse: async (_response, onText) => {
      streamCallCount += 1
      onText('recovered answer')
    },
  })
  const recoveryEvents: unknown[] = []

  await assert.rejects(
    bot.doSendMessage({
      prompt: 'broken prompt',
      rawUserInput: 'broken input',
      image,
      onEvent: () => undefined,
    }),
    (error) => error instanceof ChatError && error.code === ErrorCode.TOWERAI_REQUEST_FAILED,
  )
  await bot.doSendMessage({
    prompt: 'recovered prompt',
    rawUserInput: 'recovered input',
    onEvent: (event) => recoveryEvents.push(event),
  })

  assert.equal(streamCallCount, 1)
  assert.deepEqual(requests, [[{ role: 'user', content: 'recovered input' }]])
  assert.deepEqual(recoveryEvents, [
    { type: 'UPDATE_ANSWER', data: { text: 'recovered answer' } },
    { type: 'DONE' },
  ])
})
