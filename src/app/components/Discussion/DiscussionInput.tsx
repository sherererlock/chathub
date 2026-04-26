import { FC, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DiscussionMessage, DiscussionParticipant } from '~types'
import { getParticipantAvatar } from '~app/utils/discussion-participants'
import Button from '~app/components/Button'
import { BotId } from '~app/bots'
import { CHATBOTS } from '~app/consts'

interface Props {
  disabled: boolean
  replyTo: string | undefined
  replyMessage?: DiscussionMessage
  participants: DiscussionParticipant[]
  allParticipants: DiscussionParticipant[]
  onClearReply: () => void
  onSubmit: (input: string) => void
}

const DiscussionInput: FC<Props> = ({
  disabled,
  replyMessage,
  participants,
  allParticipants,
  onClearReply,
  onSubmit,
}) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownFilter, setDropdownFilter] = useState('')
  const [atStart, setAtStart] = useState(0)

  const filteredParticipants = allParticipants.filter((p) =>
    p.displayName.toLowerCase().includes(dropdownFilter.toLowerCase()),
  )

  const handleInput = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const val = el.value
    const cursor = el.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursor)
    const atIdx = beforeCursor.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = beforeCursor.slice(atIdx + 1)
      if (!/\s/.test(afterAt)) {
        setAtStart(atIdx)
        setDropdownFilter(afterAt)
        setDropdownOpen(true)
        return
      }
    }
    setDropdownOpen(false)
  }, [])

  const selectParticipant = useCallback(
    (participant: DiscussionParticipant) => {
      const el = inputRef.current
      if (!el) return
      const val = el.value
      const mention = `@${participant.displayName.replace(/\s/g, '')} `
      el.value = val.slice(0, atStart) + mention + val.slice(el.selectionStart ?? val.length)
      el.focus()
      setDropdownOpen(false)
    },
    [atStart],
  )

  const handleSubmit = useCallback(() => {
    const value = inputRef.current?.value.trim()
    if (!value || disabled) return
    onSubmit(value)
    if (inputRef.current) inputRef.current.value = ''
    setDropdownOpen(false)
  }, [disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') { setDropdownOpen(false); return }
      if (e.key === 'Enter' && !e.shiftKey && !dropdownOpen) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [dropdownOpen, handleSubmit],
  )

  return (
    <div className="relative flex flex-col gap-2 p-3 border-t border-primary-border bg-primary-background">
      {dropdownOpen && filteredParticipants.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 bg-primary-background border border-primary-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto w-56">
          {filteredParticipants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-secondary-background text-sm"
              onMouseDown={(e) => { e.preventDefault(); selectParticipant(p) }}
            >
              <img src={getParticipantAvatar(p)} className="w-5 h-5 rounded-full object-contain" />
              <span>{p.displayName}</span>
            </div>
          ))}
        </div>
      )}
      {replyMessage && (
        <div className="flex items-center gap-2 text-xs text-light-text bg-secondary-background rounded px-2 py-1">
          <span className="border-l-2 border-blue-400 pl-1 flex-1 truncate">
            引用: {replyMessage.author === 'user' ? 'User' : replyMessage.authorDisplayName ?? CHATBOTS[replyMessage.author as BotId]?.name}:{' '}
            {replyMessage.text.slice(0, 60)}
          </span>
          <button onClick={onClearReply} className="text-light-text hover:text-primary-text">✕</button>
        </div>
      )}
      <div className="flex flex-row items-center gap-2 text-xs text-light-text flex-wrap">
        <span className="text-light-text">快捷@:</span>
        {participants.map((p) => (
          <button
            key={p.id}
            className="px-2 py-0.5 rounded-full bg-secondary-background hover:bg-blue-100 dark:hover:bg-blue-900"
            onClick={() => {
              if (!inputRef.current) return
              inputRef.current.value += `@${p.displayName.replace(/\s/g, '')} `
              inputRef.current.focus()
            }}
          >
            {p.displayName}
          </button>
        ))}
      </div>
      <div className="flex flex-row gap-2 items-end">
        <textarea
          ref={inputRef}
          rows={2}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onClick={handleInput}
          placeholder="发送消息，或输入 @ 选择AI..."
          className="flex-1 resize-none rounded-xl border border-primary-border bg-secondary-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <Button text={t('Send')} color="primary" onClick={handleSubmit} isLoading={disabled} />
      </div>
    </div>
  )
}

export default DiscussionInput
