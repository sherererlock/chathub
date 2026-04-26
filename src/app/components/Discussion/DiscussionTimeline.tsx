import { FC, useEffect, useRef } from 'react'
import { DiscussionMessage, DiscussionParticipant } from '~types'
import DiscussionMessageCard from './DiscussionMessageCard'

interface Props {
  messages: DiscussionMessage[]
  generatingIds: Set<string>
  participants: DiscussionParticipant[]
  onQuote: (messageId: string) => void
}

const DiscussionTimeline: FC<Props> = ({ messages, generatingIds, participants, onQuote }) => {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generatingNames = [...generatingIds].map(
    (id) => participants.find((p) => p.id === id)?.displayName ?? id,
  )

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
      {generatingNames.length > 0 && (
        <div className="text-xs text-light-text animate-pulse mt-1">
          {generatingNames.join(', ')} 正在回复...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

export default DiscussionTimeline
