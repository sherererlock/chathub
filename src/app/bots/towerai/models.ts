export const TOWERAI_COMMON_MODELS = [
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
  { label: 'Claude 3.7 Sonnet', value: 'claude-3.7-sonnet' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
] as const

export function resolveTowerAIModel(selected: string, custom: string) {
  const customModel = custom.trim()
  if (customModel) {
    return customModel
  }

  const curatedModel = selected.trim()
  if (curatedModel) {
    return curatedModel
  }

  return TOWERAI_COMMON_MODELS[0].value
}
