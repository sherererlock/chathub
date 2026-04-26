import { motion } from 'framer-motion'
import { FC } from 'react'
import { CHATBOTS } from '~app/consts'
import { BotId } from '~app/bots'
import { cx } from '~/utils'
import Tooltip from '~app/components/Tooltip'

interface Props {
  participants: BotId[]
  activeBotId: BotId
  onSelectActive: (botId: BotId) => void
  onAddParticipant: (botId: BotId) => void
  onRemoveParticipant: (botId: BotId) => void
}

const ParticipantBar: FC<Props> = ({ participants, activeBotId, onSelectActive }) => {
  return (
    <div className="flex flex-row items-center gap-2 px-4 py-2 border-b border-primary-border">
      <span className="text-xs text-light-text mr-2">讨论模式</span>
      {participants.map((botId) => {
        const bot = CHATBOTS[botId]
        const isActive = botId === activeBotId
        return (
          <Tooltip key={botId} content={`${bot.name}${isActive ? '（主bot）' : '，点击设为主bot'}`}>
            <motion.img
              src={bot.avatar}
              className={cx(
                'w-7 h-7 rounded-full object-contain cursor-pointer border-2',
                isActive ? 'border-blue-500' : 'border-transparent',
              )}
              whileHover={{ scale: 1.15 }}
              onClick={() => onSelectActive(botId)}
            />
          </Tooltip>
        )
      })}
    </div>
  )
}

export default ParticipantBar
