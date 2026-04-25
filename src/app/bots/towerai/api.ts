import { createParser } from 'eventsource-parser'
import { streamAsyncIterable } from '~utils/stream-async-iterable'
import { ChatError, ErrorCode } from '~utils/errors'

export interface TowerAIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TowerAICredentials {
  token: string
  authToken: string
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

export async function requestTowerAIChat(options: {
  baseUrl: string
  model: string
  messages: TowerAIChatMessage[]
  credentials: TowerAICredentials
  signal?: AbortSignal
}) {
  const response = await fetch(resolveTowerAIEndpoint(options.baseUrl, options.model), {
    method: 'POST',
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      token: options.credentials.token,
      authorization: `Bearer ${options.credentials.token}`,
      'x-lobe-chat-auth': options.credentials.authToken,
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: true,
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

  if (!stopped && !answer) {
    throw new ChatError('TowerAI returned an empty response', ErrorCode.TOWERAI_REQUEST_FAILED)
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
