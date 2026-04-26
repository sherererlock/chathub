import { useCallback, useRef, useState } from 'react'
import { createBotInstance, BotId } from '~app/bots'
import { CHATBOTS } from '~app/consts'
import { DiscussionMessage } from '~types'
import { uuid } from '~utils'
import { ChatError } from '~utils/errors'

function parseMentions(input: string): BotId[] {
  const mentioned: BotId[] = []
  const regex = /@(\w+)/g
  let match
  while ((match = regex.exec(input)) !== null) {
    const name = match[1].toLowerCase()
    const botId = (Object.keys(CHATBOTS) as BotId[]).find(
      (id) => CHATBOTS[id].name.toLowerCase().replace(/\s/g, '') === name || id === name,
    )
    if (botId && !mentioned.includes(botId)) {
      mentioned.push(botId)
    }
  }
  return mentioned
}

function formatHistoryPrompt(messages: DiscussionMessage[]): string {
  if (messages.length === 0) return ''
  const lines = messages.map((m) => {
    const name = m.author === 'user' ? 'User' : CHATBOTS[m.author as BotId]?.name ?? m.author
    return `[${name}]: ${m.text}`
  })
  return `以下是多AI协作讨论的历史记录：\n\n${lines.join('\n\n')}\n\n请基于以上历史，回答用户的最新消息。`
}

export function useDiscussion(defaultParticipants: BotId[]) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [participants, setParticipants] = useState<BotId[]>(defaultParticipants)
  const [activeBotId, setActiveBotId] = useState<BotId>(defaultParticipants[0])
  const [generatingBots, setGeneratingBots] = useState<Set<BotId>>(new Set())
  const [replyTo, setReplyTo] = useState<string | undefined>()
  const abortControllers = useRef<Map<BotId, AbortController>>(new Map())
  const botInstances = useRef<Map<BotId, ReturnType<typeof createBotInstance>>>(new Map())

  const getBot = useCallback((botId: BotId) => {
    if (!botInstances.current.has(botId)) {
      botInstances.current.set(botId, createBotInstance(botId))
    }
    return botInstances.current.get(botId)!
  }, [])

  const sendToBot = useCallback(
    async (botId: BotId, userMessage: DiscussionMessage, history: DiscussionMessage[]) => {
      const bot = getBot(botId)
      bot.resetConversation()

      const botMsgId = uuid()
      setMessages((prev) => [...prev, { id: botMsgId, author: botId, text: '' }])
      setGeneratingBots((prev) => new Set(prev).add(botId))

      const abortController = new AbortController()
      abortControllers.current.set(botId, abortController)

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
        abortControllers.current.delete(botId)
        setGeneratingBots((prev) => {
          const next = new Set(prev)
          next.delete(botId)
          return next
        })
      }
    },
    [getBot],
  )

  const sendMessage = useCallback(
    (input: string) => {
      const mentioned = parseMentions(input)
      const targetBots = mentioned.length > 0 ? mentioned : [activeBotId]

      const userMsg: DiscussionMessage = {
        id: uuid(),
        author: 'user',
        text: input,
        replyTo,
        mentionedBots: mentioned.length > 0 ? mentioned : undefined,
      }

      setMessages((prev) => {
        const history = prev
        setTimeout(() => {
          targetBots.forEach((botId) => sendToBot(botId, userMsg, history))
        }, 0)
        return [...prev, userMsg]
      })
      setReplyTo(undefined)

      setParticipants((prev) => {
        const toAdd = targetBots.filter((b) => !prev.includes(b))
        return toAdd.length ? [...prev, ...toAdd] : prev
      })
    },
    [activeBotId, replyTo, sendToBot],
  )

  const stopBot = useCallback((botId: BotId) => {
    abortControllers.current.get(botId)?.abort()
  }, [])

  const reset = useCallback(() => {
    abortControllers.current.forEach((ac) => ac.abort())
    abortControllers.current.clear()
    botInstances.current.clear()
    setMessages([])
    setGeneratingBots(new Set())
    setReplyTo(undefined)
  }, [])

  return {
    messages,
    participants,
    activeBotId,
    setActiveBotId,
    generatingBots,
    replyTo,
    setReplyTo,
    sendMessage,
    stopBot,
    reset,
    setParticipants,
  }
}
