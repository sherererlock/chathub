import { canonicalizeTowerAIModel, getTowerAIModelsForProvider, type TowerAIProviderId } from '~app/bots/towerai/models'

export function normalizeTowerAIModelForProvider(model: string, provider: TowerAIProviderId) {
  const normalizedModel = canonicalizeTowerAIModel(model)
  const providerModels = getTowerAIModelsForProvider(provider)

  if (providerModels.some((item) => item.value === normalizedModel)) {
    return normalizedModel
  }

  return providerModels[0]?.value ?? ''
}
