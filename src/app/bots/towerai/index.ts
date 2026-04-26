import type { UserConfig } from '~services/user-config'
import { ChatError, ErrorCode } from '~utils/errors'
import { AbstractBot, SendMessageParams } from '../abstract-bot'
import {
  buildTowerAIUserMessage,
  imageToDataUrl,
  requestTowerAIChat,
  streamTowerAIResponse,
  type TowerAICredentials,
  type TowerAIChatMessage,
  isTowerAITokenExpiredError,
} from './api'
import { refreshTowerAICredentials, resolveTowerAICredentials } from './helper'
import { resolveTowerAIModel } from './models'

interface ConversationContext {
  messages: TowerAIChatMessage[]
}

export type TowerAIBotConfig = Pick<
  UserConfig,
  | 'toweraiBaseUrl'
  | 'toweraiModel'
  | 'toweraiCustomModel'
  | 'toweraiAuthMode'
  | 'toweraiHelperUrl'
  | 'toweraiToken'
  | 'toweraiAuthToken'
  | 'toweraiAutoRefresh'
  | 'toweraiWebSearch'
  | 'toweraiUseBuiltinSearch'
>

export interface TowerAIBotDependencies {
  getUserConfig: () => Promise<TowerAIBotConfig>
  resolveTowerAIModel: (selected: string, custom: string) => string
  resolveTowerAICredentials: (config: TowerAIBotConfig) => Promise<TowerAICredentials>
  refreshTowerAICredentials: (config: TowerAIBotConfig) => Promise<TowerAICredentials>
  buildTowerAIUserMessage: (prompt: string, imageUrl?: string) => TowerAIChatMessage
  imageToDataUrl: (file: File) => Promise<string>
  requestTowerAIChat: (options: {
    baseUrl: string
    model: string
    messages: TowerAIChatMessage[]
    credentials: TowerAICredentials
    webSearch?: 'off' | 'smart' | 'on'
    useBuiltinSearch?: boolean
    signal?: AbortSignal
  }) => Promise<Response>
  streamTowerAIResponse: (response: Response, onText: (text: string) => void) => Promise<void>
}

const defaultDependencies: TowerAIBotDependencies = {
  getUserConfig: async () => (await import('~services/user-config')).getUserConfig(),
  resolveTowerAIModel,
  resolveTowerAICredentials,
  refreshTowerAICredentials,
  buildTowerAIUserMessage,
  imageToDataUrl,
  requestTowerAIChat,
  streamTowerAIResponse,
}

export class TowerAIBot extends AbstractBot {
  private conversationContext?: ConversationContext
  private instanceModel: string | null = null

  constructor(private readonly deps: TowerAIBotDependencies = defaultDependencies) {
    super()
  }

  setModel(model: string) {
    this.instanceModel = model
  }

  async doSendMessage(params: SendMessageParams) {
    if (!this.conversationContext) {
      this.conversationContext = { messages: [] }
    }

    const config = await this.deps.getUserConfig()
    const model = this.instanceModel ?? this.deps.resolveTowerAIModel(config.toweraiModel, config.toweraiCustomModel)
    const credentials = await this.deps.resolveTowerAICredentials(config)
    const imageUrl = params.image ? await this.deps.imageToDataUrl(params.image) : undefined
    const userMessage = this.deps.buildTowerAIUserMessage(params.rawUserInput || params.prompt, imageUrl)
    const messages = [...this.conversationContext.messages, userMessage]

    let answer = ''

    try {
      const response = await this.deps.requestTowerAIChat({
        baseUrl: config.toweraiBaseUrl,
        model,
        messages,
        credentials,
        webSearch: config.toweraiWebSearch,
        useBuiltinSearch: config.toweraiUseBuiltinSearch,
        signal: params.signal,
      })

      await this.deps.streamTowerAIResponse(response, (text) => {
        answer = text
        params.onEvent({ type: 'UPDATE_ANSWER', data: { text } })
      })
    } catch (error) {
      if (
        error instanceof ChatError &&
        error.code === ErrorCode.TOWERAI_REQUEST_FAILED &&
        config.toweraiAuthMode === 'helper' &&
        config.toweraiAutoRefresh &&
        isTowerAITokenExpiredError(error.message)
      ) {
        const refreshedCredentials = await this.deps.refreshTowerAICredentials(config)
        const retryResponse = await this.deps.requestTowerAIChat({
          baseUrl: config.toweraiBaseUrl,
          model,
          messages,
          credentials: refreshedCredentials,
          webSearch: config.toweraiWebSearch,
          useBuiltinSearch: config.toweraiUseBuiltinSearch,
          signal: params.signal,
        })

        await this.deps.streamTowerAIResponse(retryResponse, (text) => {
          answer = text
          params.onEvent({ type: 'UPDATE_ANSWER', data: { text } })
        })
      } else {
        throw error
      }
    }

    this.conversationContext.messages.push(userMessage, { role: 'assistant', content: answer })
    params.onEvent({ type: 'DONE' })
  }

  resetConversation() {
    this.conversationContext = undefined
  }

  get name() {
    return 'TowerAI'
  }

  get supportsImageInput() {
    return true
  }
}
