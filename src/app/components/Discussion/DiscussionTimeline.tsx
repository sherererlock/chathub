import { FC, useEffect, useRef } from 'react'
import { BotId } from '~app/bots'
import { CHATBOTS } from '~app/consts'
import { DiscussionMessage } from '~types'
import DiscussionMessageCard from './DiscussionMessageCard'

interface Props {
  messages: DiscussionMessage[]
  generatingBots: Set<BotId>
  onQuote: (messageId: string) => void
}

const DiscussionTimeline: FC<Props> = ({ messages, generatingBots, onQuote }) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((msg) => (
        <DiscussionMessageCard
          key={msg.id}
          message={msg}
          allMessages={messages}
          onQuote={onQuote}
        />
      ))}
      {generatingBots.size > 0 && (
        <div className="text-xs text-light-text animate-pulse mt-1">
          {[...generatingBots].map((id) => CHATBOTS[id]?.name ?? id).join(', ')} 正在回复...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default DiscussionTimeline
