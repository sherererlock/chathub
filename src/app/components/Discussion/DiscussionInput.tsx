import { FC, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CHATBOTS } from '~app/consts'
import { BotId } from '~app/bots'
import { DiscussionMessage } from '~types'
import Button from '~app/components/Button'

interface Props {
  disabled: boolean
  replyTo: string | undefined
  replyMessage?: DiscussionMessage
  participants: BotId[]
  onClearReply: () => void
  onSubmit: (input: string) => void
}

const DiscussionInput: FC<Props> = ({ disabled, replyMessage, participants, onClearReply, onSubmit }) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const value = inputRef.current?.value.trim()
    if (!value || disabled) return
    onSubmit(value)
    if (inputRef.current) inputRef.current.value = ''
  }, [disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const insertMention = useCallback((botId: BotId) => {
    if (!inputRef.current) return
    const name = CHATBOTS[botId].name.replace(/\s/g, '')
    inputRef.current.value += `@${name} `
    inputRef.current.focus()
  }, [])

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-primary-border bg-primary-background">
      {replyMessage && (
        <div className="flex items-center gap-2 text-xs text-light-text bg-secondary-background rounded px-2 py-1">
          <span className="border-l-2 border-blue-400 pl-1 flex-1 truncate">
            引用: {replyMessage.author === 'user' ? 'User' : CHATBOTS[replyMessage.author as BotId]?.name}:{' '}
            {replyMessage.text.slice(0, 60)}
          </span>
          <button onClick={onClearReply} className="text-light-text hover:text-primary-text">✕</button>
        </div>
      )}
      <div className="flex flex-row items-center gap-2 text-xs text-light-text flex-wrap">
        <span>@</span>
        {participants.map((botId) => (
          <button
            key={botId}
            className="px-2 py-0.5 rounded-full bg-secondary-background hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={() => insertMention(botId)}
          >
            {CHATBOTS[botId].name}
          </button>
        ))}
      </div>
      <div className="flex flex-row gap-2 items-end">
        <textarea
          ref={inputRef}
          rows={2}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          placeholder="发送消息，或用 @模型名 指定AI回答..."
          className="flex-1 resize-none rounded-xl border border-primary-border bg-secondary-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <Button text={t('Send')} color="primary" onClick={handleSubmit} disabled={disabled} />
      </div>
    </div>
  )
}

export default DiscussionInput
