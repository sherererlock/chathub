import { FC } from 'react'
import { CHATBOTS } from '~app/consts'
import { BotId } from '~app/bots'
import { DiscussionMessage } from '~types'
import { cx } from '~/utils'
import Markdown from '~app/components/Markdown'

interface Props {
  message: DiscussionMessage
  allMessages: DiscussionMessage[]
  onQuote: (messageId: string) => void
}

const DiscussionMessageCard: FC<Props> = ({ message, allMessages, onQuote }) => {
  const isUser = message.author === 'user'
  const botInfo = isUser ? null : CHATBOTS[message.author as BotId]
  const quotedMsg = message.replyTo ? allMessages.find((m) => m.id === message.replyTo) : undefined

  return (
    <div className={cx('flex gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && botInfo && (
        <img src={botInfo.avatar} className="w-7 h-7 rounded-full object-contain flex-shrink-0 mt-1" />
      )}
      <div className={cx('flex flex-col max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        {!isUser && (
          <span className="text-xs text-light-text mb-1">{message.authorDisplayName ?? botInfo?.name}</span>
        )}
        {quotedMsg && (
          <div className="text-xs text-light-text bg-secondary-background rounded px-2 py-1 mb-1 border-l-2 border-blue-400 max-w-full truncate">
            {quotedMsg.author === 'user' ? 'User' : CHATBOTS[quotedMsg.author as BotId]?.name}: {quotedMsg.text.slice(0, 80)}
          </div>
        )}
        <div
          className={cx(
            'rounded-2xl px-3 py-2 text-sm cursor-pointer',
            isUser
              ? 'bg-blue-500 text-white'
              : 'bg-primary-background border border-primary-border text-primary-text',
          )}
          onClick={() => onQuote(message.id)}
          title="点击引用此消息"
        >
          {message.error ? (
            <span className="text-red-500">{message.error.message}</span>
          ) : (
            <Markdown>{message.text || '…'}</Markdown>
          )}
        </div>
      </div>
    </div>
  )
}

export default DiscussionMessageCard
