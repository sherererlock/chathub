import { BotId, createBotInstance } from '~app/bots'
import { TowerAIBot } from '~app/bots/towerai'
import { CHATBOTS } from '~app/consts'
import { TOWERAI_MODEL_PROVIDERS } from '~app/bots/towerai/models'
import { DiscussionParticipant } from '~types'

export function getAllParticipants(): DiscussionParticipant[] {
  const result: DiscussionParticipant[] = []

  // TowerAI models — one entry per model
  for (const provider of TOWERAI_MODEL_PROVIDERS) {
    for (const model of provider.models) {
      result.push({
        id: `towerai:${model.value}`,
        botId: 'towerai',
        displayName: model.label,
        modelId: model.value,
      })
    }
  }

  // Other bots (skip towerai since we expand it above)
  for (const [botId, info] of Object.entries(CHATBOTS) as [BotId, { name: string; avatar: string }][]) {
    if (botId === 'towerai') continue
    result.push({
      id: botId,
      botId,
      displayName: info.name,
    })
  }

  return result
}

export function createParticipantBot(participant: DiscussionParticipant) {
  const bot = createBotInstance(participant.botId)
  if (participant.modelId && bot instanceof TowerAIBot) {
    bot.setModel(participant.modelId)
  }
  return bot
}

export function getParticipantAvatar(participant: DiscussionParticipant): string {
  return CHATBOTS[participant.botId]?.avatar ?? ''
}

export const DEFAULT_PARTICIPANTS: DiscussionParticipant[] = (() => {
  const toweraiModels = TOWERAI_MODEL_PROVIDERS[0]?.models ?? []
  if (toweraiModels.length >= 2) {
    return [
      { id: `towerai:${toweraiModels[0].value}`, botId: 'towerai', displayName: toweraiModels[0].label, modelId: toweraiModels[0].value },
      { id: `towerai:${toweraiModels[1].value}`, botId: 'towerai', displayName: toweraiModels[1].label, modelId: toweraiModels[1].value },
    ]
  }
  return [{ id: 'towerai', botId: 'towerai', displayName: 'TowerAI' }]
})()
