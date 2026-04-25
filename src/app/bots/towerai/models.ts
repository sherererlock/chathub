export type TowerAIProviderId = 'gpt' | 'claude' | 'gemini' | 'deepseek' | 'qwen'

export interface TowerAIModelOption {
  label: string
  value: string
}

export interface TowerAIModelProvider {
  provider: TowerAIProviderId
  label: string
  models: TowerAIModelOption[]
}

export const TOWERAI_MODEL_PROVIDERS: TowerAIModelProvider[] = [
  {
    provider: 'gpt',
    label: 'GPT',
    models: [
      { label: 'GPT-5.2', value: 'gpt-5.2' },
      { label: 'GPT-5.1', value: 'gpt-5.1' },
      { label: 'GPT-5 mini', value: 'gpt-5-mini' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4o', value: 'gpt-4o' },
    ],
  },
  {
    provider: 'claude',
    label: 'Claude',
    models: [
      { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
      { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250929' },
      { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
      { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
      { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
    ],
  },
  {
    provider: 'gemini',
    label: 'Gemini',
    models: [
      { label: 'Gemini 3 Pro Preview', value: 'gemini-3-pro-preview' },
      { label: 'Gemini 3.0 Flash', value: 'gemini-3-flash-preview' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 2.5 Flash-Lite', value: 'gemini-2.5-flash-lite' },
    ],
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    models: [
      { label: 'DeepSeek V3.2 Thinking', value: 'deepseek-reasoner' },
      { label: 'DeepSeek V3', value: 'deepseek-r1' },
      { label: 'DeepSeek V3.1', value: 'deepseek-v3' },
      { label: 'DeepSeek V3.2', value: 'deepseek-chat' },
      { label: 'DeepSeek V3 0324', value: 'deepseek-v3-0324' },
    ],
  },
  {
    provider: 'qwen',
    label: 'Qwen',
    models: [
      { label: 'Qwen Long', value: 'qwen-long' },
      { label: 'Qwen Max', value: 'qwen-max' },
      { label: 'Qwen Plus', value: 'qwen-plus' },
      { label: 'Qwen Turbo', value: 'qwen-turbo' },
      { label: 'Qwen3 235B A22B', value: 'qwen3-235b-a22b' },
    ],
  },
]

export const DEFAULT_TOWERAI_PROVIDER: TowerAIProviderId = TOWERAI_MODEL_PROVIDERS[0].provider
export const DEFAULT_TOWERAI_MODEL = TOWERAI_MODEL_PROVIDERS[0].models[0].value

export function getTowerAIModelsForProvider(provider: TowerAIProviderId) {
  return TOWERAI_MODEL_PROVIDERS.find((item) => item.provider === provider)?.models ?? TOWERAI_MODEL_PROVIDERS[0].models
}

export function findTowerAIProviderByModel(model: string): TowerAIProviderId {
  const normalized = model.trim()
  if (!normalized) {
    return DEFAULT_TOWERAI_PROVIDER
  }

  const matchedProvider = TOWERAI_MODEL_PROVIDERS.find((provider) =>
    provider.models.some((item) => item.value === normalized),
  )

  return matchedProvider?.provider ?? DEFAULT_TOWERAI_PROVIDER
}

export function resolveTowerAIModel(selected: string, custom: string) {
  const customModel = custom.trim()
  if (customModel) {
    return customModel
  }

  const curatedModel = selected.trim()
  if (curatedModel) {
    return curatedModel
  }

  return DEFAULT_TOWERAI_MODEL
}
