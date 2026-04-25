import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import md5 from 'md5'

import {
  buildTowerAIUserMessage,
  requestTowerAIChat,
  streamTowerAIResponse,
  type TowerAICredentials,
  uploadTowerAIImage,
} from './api'

type FetchInput = Parameters<typeof fetch>[0]
type FetchInit = Parameters<typeof fetch>[1]

interface RecordedRequest {
  url: string
  init?: FetchInit
}

function createSseResponse(...chunks: string[]) {
  const encoder = new TextEncoder()

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
    },
  )
}

function assertTowerAITrpcRequest(
  request: RecordedRequest | undefined,
  expected: {
    url: string
    credentials: TowerAICredentials
    body: Record<string, unknown>
  },
) {
  assert.ok(request)
  assert.equal(request.url, expected.url)
  assert.equal(request.init?.method, 'POST')

  const headers = new Headers(request.init?.headers)
  assert.equal(headers.get('content-type'), 'application/json')
  assert.equal(headers.get('token'), expected.credentials.token)
  assert.equal(headers.get('authorization'), `Bearer ${expected.credentials.token}`)
  assert.equal(headers.get('x-lobe-chat-auth'), expected.credentials.authToken)

  const body = request.init?.body
  if (typeof body !== 'string') {
    throw new TypeError('expected TRPC request body to be a JSON string')
  }

  assert.deepEqual(JSON.parse(body), {
    0: {
      json: expected.body,
    },
  })
}

test('buildTowerAIUserMessage returns plain text content when no image url is provided', () => {
  assert.deepEqual(buildTowerAIUserMessage('describe this image'), {
    role: 'user',
    content: 'describe this image',
  })
})

test('buildTowerAIUserMessage returns multimodal content when image url is provided', () => {
  assert.deepEqual(buildTowerAIUserMessage('describe this image', 'https://cdn.example.com/image.png'), {
    role: 'user',
    content: [
      { type: 'text', text: 'describe this image' },
      { type: 'image_url', image_url: { url: 'https://cdn.example.com/image.png', detail: 'auto' } },
    ],
  })
})

test('buildTowerAIUserMessage allows image-only requests', () => {
  assert.deepEqual(buildTowerAIUserMessage('', 'https://cdn.example.com/image.png'), {
    role: 'user',
    content: [{ type: 'image_url', image_url: { url: 'https://cdn.example.com/image.png', detail: 'auto' } }],
  })
})

test('requestTowerAIChat sends TowerAI auth headers and SSE accept header', async () => {
  const baseUrl = 'https://tower-ai.yottastudios.com'
  const credentials: TowerAICredentials = { token: 'token-1', authToken: 'auth-1' }
  const requests: RecordedRequest[] = []

  const fetchMock = mock.method(globalThis, 'fetch', async (input: FetchInput, init?: FetchInit) => {
    requests.push({ url: String(input), init })
    return new Response(null, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
    })
  })

  const response = await requestTowerAIChat({
    baseUrl,
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: 'hello' }],
    credentials,
  })

  assert.equal(fetchMock.mock.callCount(), 1)
  assert.equal(requests[0]?.url, `${baseUrl}/zi/webapi/chat/openai`)
  assert.equal(requests[0]?.init?.method, 'POST')

  const headers = new Headers(requests[0]?.init?.headers)
  assert.equal(headers.get('content-type'), 'application/json')
  assert.equal(headers.get('token'), credentials.token)
  assert.equal(headers.get('authorization'), `Bearer ${credentials.token}`)
  assert.equal(headers.get('x-lobe-chat-auth'), credentials.authToken)
  assert.equal(headers.get('accept'), 'text/event-stream')

  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
  })
  assert.equal(response.headers.get('content-type'), 'text/event-stream')
})

test('streamTowerAIResponse completes after text and stop events', async () => {
  const updates: string[] = []

  await streamTowerAIResponse(
    createSseResponse('event: text\ndata: "hel', 'lo"\n\n', 'event: stop\ndata: done\n\n'),
    (text) => updates.push(text),
  )

  assert.deepEqual(updates, ['hello'])
})

test('streamTowerAIResponse rejects when the stream ends without a stop event', async () => {
  const updates: string[] = []

  await assert.rejects(
    streamTowerAIResponse(createSseResponse('event: text\ndata: "hello"\n\n'), (text) => updates.push(text)),
    /stop event/i,
  )

  assert.deepEqual(updates, ['hello'])
})

test('streamTowerAIResponse rejects when TowerAI stops without returning text', async () => {
  await assert.rejects(
    streamTowerAIResponse(createSseResponse('event: stop\ndata: done\n\n'), () => undefined),
    /empty response/i,
  )
})

test('uploadTowerAIImage performs the TowerAI upload sequence and returns the uploaded image url', async () => {
  const baseUrl = 'https://tower-ai.yottastudios.com'
  const credentials: TowerAICredentials = { token: 'token-1', authToken: 'auth-1' }
  const file = new File(['png-bytes'], 'image.png', { type: 'image/png' })
  const expectedFileHash = md5(new Uint8Array(await file.arrayBuffer()))
  const requests: RecordedRequest[] = []

  const fetchMock = mock.method(globalThis, 'fetch', async (input: FetchInput, init?: FetchInit) => {
    const url = String(input)
    requests.push({ url, init })

    if (url.includes('file.checkFileHash')) {
      return new Response(
        JSON.stringify([{ result: { data: { json: { exists: false, fileHash: 'hash-1' } } } }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (url.includes('upload.createS3PreSignedUrl')) {
      return new Response(
        JSON.stringify([
          {
            result: {
              data: {
                json: {
                  uploadUrl: 'https://storage.googleapis.com/tower-ai/files/493644/image.png?signature=1',
                  fileUrl: 'https://storage.googleapis.com/tower-ai/files/493644/image.png',
                },
              },
            },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (url.startsWith('https://storage.googleapis.com/')) {
      assert.equal(init?.method, 'PUT')
      return new Response(null, { status: 200 })
    }

    if (url.includes('file.createFile')) {
      return new Response(
        JSON.stringify([
          {
            result: {
              data: {
                json: {
                  id: 'file_123',
                  name: 'image.png',
                  mimeType: 'image/png',
                  url: 'https://storage.googleapis.com/tower-ai/files/493644/image.png',
                },
              },
            },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    throw new Error(`unexpected fetch url: ${url}`)
  })

  const result = await uploadTowerAIImage({
    baseUrl,
    file,
    credentials,
  })

  assert.equal(fetchMock.mock.callCount(), 4)
  assertTowerAITrpcRequest(requests[0], {
    url: `${baseUrl}/zi/trpc/lambda/file.checkFileHash?batch=1`,
    credentials,
    body: {
      hash: expectedFileHash,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    },
  })

  assertTowerAITrpcRequest(requests[1], {
    url: `${baseUrl}/zi/trpc/lambda/upload.createS3PreSignedUrl?batch=1`,
    credentials,
    body: {
      hash: expectedFileHash,
      fileName: file.name,
      mimeType: file.type,
      pathname: `files/${expectedFileHash}/${file.name}`,
      size: file.size,
    },
  })

  assert.ok(requests[2])
  assert.equal(requests[2].url, 'https://storage.googleapis.com/tower-ai/files/493644/image.png?signature=1')
  assert.equal(requests[2].init?.method, 'PUT')
  assert.equal(new Headers(requests[2].init?.headers).get('content-type'), file.type)
  assert.equal(requests[2].init?.body, file)

  assertTowerAITrpcRequest(requests[3], {
    url: `${baseUrl}/zi/trpc/lambda/file.createFile?batch=1`,
    credentials,
    body: {
      hash: expectedFileHash,
      fileName: file.name,
      mimeType: file.type,
      pathname: `files/${expectedFileHash}/${file.name}`,
      size: file.size,
      url: 'https://storage.googleapis.com/tower-ai/files/493644/image.png',
    },
  })
  assert.equal(result.fileId, 'file_123')
  assert.equal(result.url, 'https://storage.googleapis.com/tower-ai/files/493644/image.png')
  assert.equal(result.mimeType, 'image/png')
  assert.equal(result.name, 'image.png')
})

test('uploadTowerAIImage throws a TowerAI request error when object storage upload fails', async () => {
  const baseUrl = 'https://tower-ai.yottastudios.com'
  const credentials: TowerAICredentials = { token: 'token-1', authToken: 'auth-1' }
  const file = new File(['png-bytes'], 'image.png', { type: 'image/png' })
  const requests: RecordedRequest[] = []

  const fetchMock = mock.method(globalThis, 'fetch', async (input: FetchInput, init?: FetchInit) => {
    const url = String(input)
    requests.push({ url, init })

    if (url.includes('file.checkFileHash')) {
      return new Response(
        JSON.stringify([{ result: { data: { json: { exists: false, fileHash: 'hash-1' } } } }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (url.includes('upload.createS3PreSignedUrl')) {
      return new Response(
        JSON.stringify([
          {
            result: {
              data: {
                json: {
                  uploadUrl: 'https://storage.googleapis.com/tower-ai/files/493644/image.png?signature=1',
                  fileUrl: 'https://storage.googleapis.com/tower-ai/files/493644/image.png',
                },
              },
            },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (url.startsWith('https://storage.googleapis.com/')) {
      return new Response('denied', { status: 403 })
    }

    throw new Error(`unexpected fetch url: ${url}`)
  })

  await assert.rejects(
    uploadTowerAIImage({
      baseUrl,
      file,
      credentials,
    }),
    /TowerAI image upload failed/,
  )

  assert.equal(fetchMock.mock.callCount(), 3)
  assert.equal(requests[2]?.url, 'https://storage.googleapis.com/tower-ai/files/493644/image.png?signature=1')
  assert.equal(requests[2]?.init?.method, 'PUT')
})
