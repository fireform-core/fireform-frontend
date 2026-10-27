import type { LLMModelChoice, LLMModelInfo, LLMModelsResponse, LLMProviderModels } from './api'

export interface LLMModelOption {
  model: LLMModelInfo
  downloadable: boolean
}

export function providersWithOllama(catalog: LLMModelsResponse): LLMProviderModels[] {
  if (catalog.providers.some(provider => provider.provider === 'ollama')) {
    return catalog.providers
  }
  return [
    ...catalog.providers,
    {
      provider: 'ollama',
      available: false,
      detail: 'Ollama is not enabled on this server.',
      models: [],
    },
  ]
}

export function optionsFor(provider: LLMProviderModels | undefined): LLMModelOption[] {
  if (!provider?.available) return []
  const ollama = provider.provider === 'ollama'
  const installed = provider.models.filter(model => !ollama || model.installed !== false)
  const downloadable = ollama
    ? (provider.downloadable || []).filter(model => !installed.some(item => item.name === model.name))
    : []
  return [
    ...installed.map(model => ({ model, downloadable: false })),
    ...downloadable.map(model => ({ model, downloadable: true })),
  ]
}

export function isUsable(provider: LLMProviderModels | undefined, model: string): boolean {
  return Boolean(
    provider?.available &&
    provider.models.some(item => item.name === model && (provider.provider !== 'ollama' || item.installed !== false))
  )
}

export function defaultChoice(catalog: LLMModelsResponse): LLMModelChoice | null {
  const providers = providersWithOllama(catalog)
  const preferredProvider = providers.find(provider => provider.provider === catalog.default.provider)
  if (isUsable(preferredProvider, catalog.default.model)) return catalog.default

  for (const provider of providers) {
    const options = optionsFor(provider)
    const option = options.find(item => !item.downloadable && item.model.name === provider.default_model)
      || options.find(item => !item.downloadable)
    if (option) return { provider: provider.provider, model: option.model.name }
  }
  return null
}

export function reconcileChoice(
  catalog: LLMModelsResponse,
  selected: LLMModelChoice | null
): LLMModelChoice | null {
  if (selected) {
    const provider = providersWithOllama(catalog).find(item => item.provider === selected.provider)
    if (isUsable(provider, selected.model)) return selected
  }
  return defaultChoice(catalog)
}
