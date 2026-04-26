import { atomWithStorage } from 'jotai/utils'
import { useAtom } from 'jotai'
import { FC, useMemo } from 'react'
import { DiscussionParticipant } from '~types'
import { useDiscussion } from '~app/hooks/use-discussion'
import { getAllParticipants, DEFAULT_PARTICIPANTS } from '~app/utils/discussion-participants'
import ParticipantBar from '~app/components/Discussion/ParticipantBar'
import DiscussionTimeline from '~app/components/Discussion/DiscussionTimeline'
import DiscussionInput from '~app/components/Discussion/DiscussionInput'

const discussionParticipantsAtom = atomWithStorage<DiscussionParticipant[]>(
  'discussionParticipants2',
  DEFAULT_PARTICIPANTS,
  undefined,
  { getOnInit: true },
)

const allParticipants = getAllParticipants()

const DiscussionPanel: FC = () => {
  const [savedParticipants] = useAtom(discussionParticipantsAtom)

  const {
    messages,
    participants,
    activeParticipant,
    setActiveParticipant,
    generatingIds,
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
        activeParticipant={activeParticipant}
        onSelectActive={setActiveParticipant}
      />
      <DiscussionTimeline
        messages={messages}
        generatingIds={generatingIds}
        participants={allParticipants}
        onQuote={setReplyTo}
      />
      <DiscussionInput
        disabled={generatingIds.size > 0}
        replyTo={replyTo}
        replyMessage={replyMessage}
        participants={participants}
        allParticipants={allParticipants}
        onClearReply={() => setReplyTo(undefined)}
        onSubmit={sendMessage}
      />
    </div>
  )
}

export default DiscussionPanel
