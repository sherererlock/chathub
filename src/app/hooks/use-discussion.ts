import { useCallback, useRef, useState } from 'react'
import { DiscussionMessage, DiscussionParticipant } from '~types'
import { createParticipantBot } from '~app/utils/discussion-participants'
import { uuid } from '~utils'
import { ChatError } from '~utils/errors'
import { BotId } from '~app/bots'

function parseMentions(input: string, participants: DiscussionParticipant[]): DiscussionParticipant[] {
  const mentioned: DiscussionParticipant[] = []
  const regex = /@(\S+)/g
  let match
  while ((match = regex.exec(input)) !== null) {
    const name = match[1].toLowerCase().replace(/\s/g, '')
    const participant = participants.find(
      (p) => p.displayName.toLowerCase().replace(/\s/g, '') === name || p.id.toLowerCase() === name,
    )
    if (participant && !mentioned.find((m) => m.id === participant.id)) {
      mentioned.push(participant)
    }
  }
  return mentioned
}

function formatHistoryPrompt(messages: DiscussionMessage[]): string {
  if (messages.length === 0) return ''
  const lines = messages.map((m) => {
    const name = m.author === 'user' ? 'User' : m.authorDisplayName ?? m.author
    return `[${name}]: ${m.text}`
  })
  return `以下是多AI协作讨论的历史记录：\n\n${lines.join('\n\n')}\n\n请基于以上历史，回答用户的最新消息。`
}

export function useDiscussion(defaultParticipants: DiscussionParticipant[]) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [participants, setParticipants] = useState<DiscussionParticipant[]>(defaultParticipants)
  const [activeParticipant, setActiveParticipant] = useState<DiscussionParticipant>(defaultParticipants[0])
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<string | undefined>()
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const botInstances = useRef<Map<string, ReturnType<typeof createParticipantBot>>>(new Map())

  const getBot = useCallback((participant: DiscussionParticipant) => {
    if (!botInstances.current.has(participant.id)) {
      botInstances.current.set(participant.id, createParticipantBot(participant))
    }
    return botInstances.current.get(participant.id)!
  }, [])

  const sendToParticipant = useCallback(
    async (participant: DiscussionParticipant, userMessage: DiscussionMessage, history: DiscussionMessage[]) => {
      const bot = getBot(participant)
      bot.resetConversation()

      const botMsgId = uuid()
      setMessages((prev) => [
        ...prev,
        { id: botMsgId, author: participant.botId as BotId | 'user', authorDisplayName: participant.displayName, text: '' },
      ])
      setGeneratingIds((prev) => new Set(prev).add(participant.id))

      const abortController = new AbortController()
      abortControllers.current.set(participant.id, abortController)

      const historyPrompt = formatHistoryPrompt(history)
      const fullPrompt = historyPrompt
        ? `${historyPrompt}\n\n[User]: ${userMessage.text}`
        : userMessage.text

      try {
        const resp = await bot.sendMessage({ prompt: fullPrompt, signal: abortController.signal })
        for await (const answer of resp) {
          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, text: answer.text } : m)),
          )
        }
      } catch (err) {
        const error = err as ChatError
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsgId ? { ...m, error } : m)),
        )
      } finally {
        abortControllers.current.delete(participant.id)
        setGeneratingIds((prev) => {
          const next = new Set(prev)
          next.delete(participant.id)
          return next
        })
      }
    },
    [getBot],
  )

  const sendMessage = useCallback(
    (input: string) => {
      const mentioned = parseMentions(input, participants)
      const targets = mentioned.length > 0 ? mentioned : [activeParticipant]

      const userMsg: DiscussionMessage = {
        id: uuid(),
        author: 'user',
        text: input,
        replyTo,
        mentionedBots: mentioned.length > 0 ? mentioned.map((p) => p.botId as BotId) : undefined,
      }

      const historySnapshot = messages
      setMessages((prev) => [...prev, userMsg])
      targets.forEach((p) => sendToParticipant(p, userMsg, historySnapshot))
      setReplyTo(undefined)

      setParticipants((prev) => {
        const toAdd = targets.filter((t) => !prev.find((p) => p.id === t.id))
        return toAdd.length ? [...prev, ...toAdd] : prev
      })
    },
    [activeParticipant, messages, participants, replyTo, sendToParticipant],
  )

  const stopParticipant = useCallback((participantId: string) => {
    abortControllers.current.get(participantId)?.abort()
  }, [])

  const reset = useCallback(() => {
    abortControllers.current.forEach((ac) => ac.abort())
    abortControllers.current.clear()
    botInstances.current.clear()
    setMessages([])
    setGeneratingIds(new Set())
    setReplyTo(undefined)
  }, [])

  return {
    messages,
    participants,
    activeParticipant,
    setActiveParticipant,
    generatingIds,
    replyTo,
    setReplyTo,
    sendMessage,
    stopParticipant,
    reset,
    setParticipants,
  }
}
