import { atomWithStorage } from 'jotai/utils'
import { useAtom } from 'jotai'
import { FC, useMemo } from 'react'
import { BotId } from '~app/bots'
import { useDiscussion } from '~app/hooks/use-discussion'
import ParticipantBar from '~app/components/Discussion/ParticipantBar'
import DiscussionTimeline from '~app/components/Discussion/DiscussionTimeline'
import DiscussionInput from '~app/components/Discussion/DiscussionInput'

const discussionParticipantsAtom = atomWithStorage<BotId[]>(
  'discussionParticipants',
  ['towerai', 'towerai'],
  undefined,
  { getOnInit: true },
)

const DiscussionPanel: FC = () => {
  const [savedParticipants] = useAtom(discussionParticipantsAtom)

  const {
    messages,
    participants,
    activeBotId,
    setActiveBotId,
    generatingBots,
    replyTo,
    setReplyTo,
    sendMessage,
    setParticipants,
  } = useDiscussion(savedParticipants)

  const replyMessage = useMemo(
    () => (replyTo ? messages.find((m) => m.id === replyTo) : undefined),
    [replyTo, messages],
  )

  return (
    <div className="flex flex-col h-full bg-secondary-background rounded-2xl overflow-hidden">
      <ParticipantBar
        participants={participants}
        activeBotId={activeBotId}
        onSelectActive={setActiveBotId}
        onAddParticipant={(botId) => setParticipants((prev) => [...prev, botId])}
        onRemoveParticipant={(botId) => setParticipants((prev) => prev.filter((b) => b !== botId))}
      />
      <DiscussionTimeline
        messages={messages}
        generatingBots={generatingBots}
        onQuote={setReplyTo}
      />
      <DiscussionInput
        disabled={false}
        replyTo={replyTo}
        replyMessage={replyMessage}
        participants={participants}
        onClearReply={() => setReplyTo(undefined)}
        onSubmit={sendMessage}
      />
    </div>
  )
}

export default DiscussionPanel
