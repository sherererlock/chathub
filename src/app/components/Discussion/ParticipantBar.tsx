import { motion } from 'framer-motion'
import { FC } from 'react'
import { DiscussionParticipant } from '~types'
import { getParticipantAvatar } from '~app/utils/discussion-participants'
import { cx } from '~/utils'
import Tooltip from '~app/components/Tooltip'

interface Props {
  participants: DiscussionParticipant[]
  activeParticipant: DiscussionParticipant
  onSelectActive: (participant: DiscussionParticipant) => void
}

const ParticipantBar: FC<Props> = ({ participants, activeParticipant, onSelectActive }) => {
  return (
    <div className="flex flex-row items-center gap-2 px-4 py-2 border-b border-primary-border">
      <span className="text-xs text-light-text mr-2">讨论模式</span>
      {participants.map((p) => {
        const isActive = p.id === activeParticipant.id
        return (
          <Tooltip key={p.id} content={`${p.displayName}${isActive ? '（主发言人）' : '，点击设为主发言人'}`}>
            <div className="flex flex-col items-center gap-0.5">
              <motion.img
                src={getParticipantAvatar(p)}
                className={cx(
                  'w-7 h-7 rounded-full object-contain cursor-pointer border-2',
                  isActive ? 'border-blue-500' : 'border-transparent',
                )}
                whileHover={{ scale: 1.15 }}
                onClick={() => onSelectActive(p)}
              />
              <span className="text-[9px] text-light-text max-w-[40px] truncate">{p.displayName}</span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default ParticipantBar
