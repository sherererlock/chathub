import { getUserConfig } from '~services/user-config'
import { ChatError, ErrorCode } from '~utils/errors'
import { AbstractBot, SendMessageParams } from '../abstract-bot'
import { requestTowerAIChat, streamTowerAIResponse, isTowerAITokenExpiredError } from './api'
import { refreshTowerAICredentials, resolveTowerAICredentials } from './helper'
import { resolveTowerAIModel } from './models'

interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export class TowerAIBot extends AbstractBot {
  private conversationContext?: ConversationContext

  async doSendMessage(params: SendMessageParams) {
    if (!this.conversationContext) {
      this.conversationContext = { messages: [] }
    }

    const config = await getUserConfig()
    const model = resolveTowerAIModel(config.toweraiModel, config.toweraiCustomModel)
    const userMessage = { role: 'user' as const, content: params.prompt }
    const messages = [...this.conversationContext.messages, userMessage]

    let answer = ''

    try {
      const credentials = await resolveTowerAICredentials(config)
      const response = await requestTowerAIChat({
        baseUrl: config.toweraiBaseUrl,
        model,
        messages,
        credentials,
        signal: params.signal,
      })

      await streamTowerAIResponse(response, (text) => {
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
        const refreshedCredentials = await refreshTowerAICredentials(config)
        const retryResponse = await requestTowerAIChat({
          baseUrl: config.toweraiBaseUrl,
          model,
          messages,
          credentials: refreshedCredentials,
          signal: params.signal,
        })

        await streamTowerAIResponse(retryResponse, (text) => {
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
}
