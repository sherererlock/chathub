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
      { label: 'GPT-5.4', value: 'gpt-5.4' },
      { label: 'GPT-5.1', value: 'gpt-5.2' },
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
      { label: 'Gemini 3.1 Pro Preview', value: 'gemini-3.1-pro-preview' },
      { label: 'Gemini 3.0 Flash', value: 'gemini-3-flash-preview' },
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

export const TOWERAI_COMMON_MODELS = TOWERAI_MODEL_PROVIDERS.flatMap((provider) => provider.models)

const LEGACY_TOWERAI_MODEL_ALIASES: Partial<Record<string, string>> = {
  'claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
  'claude-3.7-sonnet': 'claude-3-7-sonnet-20250219',
}

export function getTowerAIModelsForProvider(provider: TowerAIProviderId) {
  return TOWERAI_MODEL_PROVIDERS.find((item) => item.provider === provider)?.models ?? TOWERAI_MODEL_PROVIDERS[0].models
}

export function canonicalizeTowerAIModel(model: string) {
  const normalized = model.trim()
  return LEGACY_TOWERAI_MODEL_ALIASES[normalized] ?? normalized
}

export function findTowerAIProviderByModel(model: string): TowerAIProviderId {
  const canonicalModel = canonicalizeTowerAIModel(model)
  if (!canonicalModel) {
    return DEFAULT_TOWERAI_PROVIDER
  }

  const matchedProvider = TOWERAI_MODEL_PROVIDERS.find((provider) =>
    provider.models.some((item) => item.value === canonicalModel),
  )

  return matchedProvider?.provider ?? DEFAULT_TOWERAI_PROVIDER
}

export function resolveTowerAIModel(selected: string, custom: string) {
  const customModel = custom.trim()
  if (customModel) {
    return customModel
  }

  const curatedModel = canonicalizeTowerAIModel(selected)
  if (TOWERAI_COMMON_MODELS.some((item) => item.value === curatedModel)) {
    return curatedModel
  }

  return DEFAULT_TOWERAI_MODEL
}
