import md5 from 'md5'
import { createParser } from 'eventsource-parser'
import { streamAsyncIterable } from '~utils/stream-async-iterable'
import { ChatError, ErrorCode } from '~utils/errors'

export type TowerAIMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } }

export interface TowerAIChatMessage {
  role: 'user' | 'assistant'
  content: string | TowerAIMessageContentPart[]
}

export interface TowerAICredentials {
  token: string
  authToken: string
}

export interface TowerAIUploadedImage {
  fileId: string
  url: string
  mimeType: string
  name: string
}

export function buildTowerAIUserMessage(prompt: string, imageUrl?: string): TowerAIChatMessage {
  if (!imageUrl) {
    return {
      role: 'user',
      content: prompt,
    }
  }

  const content: TowerAIMessageContentPart[] = []
  if (prompt.trim()) {
    content.push({ type: 'text', text: prompt })
  }
  content.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } })

  return {
    role: 'user',
    content,
  }
}

export function resolveTowerAIEndpoint(baseUrl: string, model: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  if (model.startsWith('gemini') || model.startsWith('claude')) {
    return `${normalizedBaseUrl}/zi/webapi/chat/vertexai`
  }
  return `${normalizedBaseUrl}/zi/webapi/chat/openai`
}

export function isTowerAITokenExpiredError(message: string) {
  return message.includes('600015') || message.includes('token过期')
}

export function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

export async function uploadTowerAIImage(options: {
  baseUrl: string
  file: File
  credentials: TowerAICredentials
  signal?: AbortSignal
}): Promise<TowerAIUploadedImage> {
  const mimeType = options.file.type || 'application/octet-stream'
  const fileHash = await computeTowerAIFileHash(options.file)
  const pathname = buildTowerAIUploadPathname(fileHash, options.file.name)

  await requestTowerAITrpc({
    baseUrl: options.baseUrl,
    path: '/zi/trpc/lambda/file.checkFileHash?batch=1',
    body: {
      hash: fileHash,
      fileName: options.file.name,
      mimeType,
      size: options.file.size,
    },
    credentials: options.credentials,
    signal: options.signal,
  })

  const presigned = await requestTowerAITrpc<{
    uploadUrl: string
    fileUrl: string
  }>({
    baseUrl: options.baseUrl,
    path: '/zi/trpc/lambda/upload.createS3PreSignedUrl?batch=1',
    body: {
      fileName: options.file.name,
      mimeType,
      pathname,
      size: options.file.size,
      hash: fileHash,
    },
    credentials: options.credentials,
    signal: options.signal,
  })

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    signal: options.signal,
    headers: {
      'content-type': mimeType,
    },
    body: options.file,
  })

  if (!uploadResponse.ok) {
    throw new ChatError('TowerAI image upload failed', ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  const createdFile = await requestTowerAITrpc<{
    id: string
    name?: string
    mimeType?: string
    url?: string
  }>({
    baseUrl: options.baseUrl,
    path: '/zi/trpc/lambda/file.createFile?batch=1',
    body: {
      hash: fileHash,
      fileName: options.file.name,
      mimeType,
      pathname,
      size: options.file.size,
      url: presigned.fileUrl,
    },
    credentials: options.credentials,
    signal: options.signal,
  })

  return {
    fileId: createdFile.id,
    url: createdFile.url || presigned.fileUrl,
    mimeType: createdFile.mimeType || mimeType,
    name: createdFile.name || options.file.name,
  }
}

export async function requestTowerAIChat(options: {
  baseUrl: string
  model: string
  messages: TowerAIChatMessage[]
  credentials: TowerAICredentials
  webSearch?: 'off' | 'smart' | 'on'
  useBuiltinSearch?: boolean
  signal?: AbortSignal
}) {
  const enabledSearch = options.webSearch !== 'off' ? true : undefined
  const response = await fetch(resolveTowerAIEndpoint(options.baseUrl, options.model), {
    method: 'POST',
    signal: options.signal,
    headers: {
      ...buildTowerAIAuthHeaders(options.credentials),
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
      ...(enabledSearch !== undefined && { enabledSearch, searchMode: options.webSearch }),
      ...(enabledSearch && options.useBuiltinSearch !== undefined && { useModelBuiltinSearch: options.useBuiltinSearch }),
    }),
  })

  if (!response.ok) {
    const message = await readTowerAIError(response)
    throw new ChatError(message, ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  return response
}

export async function streamTowerAIResponse(
  response: Response,
  onText: (text: string) => void,
) {
  if (!response.body) {
    throw new ChatError('TowerAI response body missing', ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  let answer = ''
  let stopped = false
  const decoder = new TextDecoder()
  const parser = createParser((event) => {
    if (event.type !== 'event') {
      return
    }

    if (event.event === 'text' && event.data) {
      answer += parseTowerAIText(event.data)
      onText(answer)
    }

    if (event.event === 'stop') {
      stopped = true
    }
  })

  for await (const chunk of streamAsyncIterable(response.body)) {
    parser.feed(decoder.decode(chunk, { stream: true }))
  }

  parser.feed(decoder.decode())

  if (!answer) {
    throw new ChatError('TowerAI returned an empty response', ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  if (!stopped) {
    throw new ChatError('TowerAI stream ended before stop event', ErrorCode.TOWERAI_REQUEST_FAILED)
  }
}

async function readTowerAIError(response: Response) {
  const text = await response.text()
  if (!text) {
    return `TowerAI request failed (${response.status})`
  }

  try {
    const body = JSON.parse(text) as { message?: unknown; error?: unknown }
    if (typeof body.message === 'string' && body.message) {
      return body.message
    }
    if (typeof body.error === 'string' && body.error) {
      return body.error
    }
  } catch {
    // ignore JSON parse errors and fall back to raw text
  }

  return text
}

function parseTowerAIText(data: string) {
  try {
    const parsed = JSON.parse(data) as unknown
    return typeof parsed === 'string' ? parsed : String(parsed ?? '')
  } catch {
    return data
  }
}

function buildTowerAIAuthHeaders(credentials: TowerAICredentials) {
  return {
    'content-type': 'application/json',
    token: credentials.token,
    authorization: `Bearer ${credentials.token}`,
    'x-lobe-chat-auth': credentials.authToken,
  }
}

function buildTowerAITrpcBody(input: unknown) {
  return JSON.stringify({
    0: {
      json: input,
    },
  })
}

async function computeTowerAIFileHash(file: File) {
  return md5(new Uint8Array(await file.arrayBuffer()))
}

function buildTowerAIUploadPathname(fileHash: string, fileName: string) {
  return `files/${fileHash}/${fileName}`
}

async function requestTowerAITrpc<T>(options: {
  baseUrl: string
  path: string
  body: unknown
  credentials: TowerAICredentials
  signal?: AbortSignal
}) {
  const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}${options.path}`, {
    method: 'POST',
    signal: options.signal,
    headers: buildTowerAIAuthHeaders(options.credentials),
    body: buildTowerAITrpcBody(options.body),
  })

  if (!response.ok) {
    throw new ChatError(await readTowerAIError(response), ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  const payload = (await response.json()) as Array<{ result?: { data?: { json?: T } } }>
  const result = payload[0]?.result?.data?.json
  if (!result) {
    throw new ChatError('TowerAI upload response missing json payload', ErrorCode.TOWERAI_REQUEST_FAILED)
  }

  return result
}
