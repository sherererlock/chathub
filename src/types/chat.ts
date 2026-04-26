import { BotId } from '~app/bots'
import { ChatError } from '~utils/errors'

export interface ChatMessageModel {
  id: string
  author: BotId | 'user'
  text: string
  image?: Blob
  error?: ChatError
}

export interface ConversationModel {
  messages: ChatMessageModel[]
}

export interface DiscussionMessage {
  id: string
  author: BotId | 'user'
  text: string
  replyTo?: string
  mentionedBots?: BotId[]
  error?: ChatError
}
