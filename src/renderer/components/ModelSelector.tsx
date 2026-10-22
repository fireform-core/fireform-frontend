import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import {
  fetchLLMModels,
  type LLMModelChoice,
  type LLMModelInfo,
  type LLMModelsResponse,
  type LLMProviderModels,
} from '../lib/api'
import { cn } from '../lib/utils'

interface ModelOption {
  model: LLMModelInfo
  downloadable: boolean
}

const OLLAMA_PROVIDER = 'ollama'

function providersWithOllama(catalog: LLMModelsResponse): LLMProviderModels[] {
  if (catalog.providers.some(provider => provider.provider === OLLAMA_PROVIDER)) {
    return catalog.providers
  }
  return [
    ...catalog.providers,
    {
      provider: OLLAMA_PROVIDER,
      available: false,
      detail: 'Ollama is not enabled on this server.',
      models: [],
    },
  ]
}

function optionsFor(provider: LLMProviderModels | undefined): ModelOption[] {
  if (!provider?.available) return []
  const ollama = provider.provider === OLLAMA_PROVIDER
  const installed = provider.models.filter(model => !ollama || model.installed !== false)
  const downloadable = ollama
    ? (provider.downloadable || []).filter(model => !installed.some(item => item.name === model.name))
    : []
  return [
    ...installed.map(model => ({ model, downloadable: false })),
    ...downloadable.map(model => ({ model, downloadable: true })),
  ]
}

function isUsable(provider: LLMProviderModels | undefined, model: string): boolean {
  return Boolean(
    provider?.available &&
    provider.models.some(item => item.name === model && (provider.provider !== OLLAMA_PROVIDER || item.installed !== false))
  )
}

function sameChoice(left: LLMModelChoice | null, right: LLMModelChoice | null): boolean {
  return left?.provider === right?.provider && left?.model === right?.model
}

function defaultChoice(catalog: LLMModelsResponse, providers: LLMProviderModels[]): LLMModelChoice | null {
  const backendDefault = catalog.default
  const defaultProvider = providers.find(provider => provider.provider === backendDefault.provider)
  if (isUsable(defaultProvider, backendDefault.model)) return backendDefault

  for (const provider of providers) {
    const options = optionsFor(provider)
    const model = options.find(option => !option.downloadable && option.model.name === provider.default_model)
      || options.find(option => !option.downloadable)
    if (model) return { provider: provider.provider, model: model.model.name }
  }
  return null
}

function reconcileChoice(
  catalog: LLMModelsResponse,
  saved: LLMModelChoice | null
): { active: LLMModelChoice | null; draft: LLMModelChoice } {
  const providers = providersWithOllama(catalog)
  const savedProvider = providers.find(item => item.provider === saved?.provider)
  const savedIsValid = Boolean(saved && isUsable(savedProvider, saved.model))
  const active = savedIsValid && saved
    ? saved
    : defaultChoice(catalog, providers)
  if (savedIsValid && active) return { active, draft: active }

  const defaultProvider = providers.find(item => item.provider === catalog.default.provider)
  const defaultOptions = optionsFor(defaultProvider)
  const defaultOption = defaultOptions.find(option => option.model.name === catalog.default.model)
    || defaultOptions[0]
  if (defaultProvider && defaultOption) {
    return {
      active,
      draft: { provider: defaultProvider.provider, model: defaultOption.model.name },
    }
  }
  if (active) return { active, draft: active }

  for (const provider of providers) {
    const option = optionsFor(provider)[0]
    if (option) return { active: null, draft: { provider: provider.provider, model: option.model.name } }
  }

  return { active: null, draft: { provider: catalog.default.provider || OLLAMA_PROVIDER, model: '' } }
}

export function ModelSelector() {
  const selectedLLM = useStore(state => state.selectedLLM)
  const setSelectedLLM = useStore(state => state.setSelectedLLM)
  const modelDownload = useStore(state => state.modelDownload)
  const startModelDownload = useStore(state => state.startModelDownload)
  const [catalog, setCatalog] = useState<LLMModelsResponse | null>(null)
  const [selectedProvider, setSelectedProvider] = useState(selectedLLM?.provider || OLLAMA_PROVIDER)
  const [selectedModel, setSelectedModel] = useState(selectedLLM?.model || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const applyCatalog = useCallback((data: LLMModelsResponse) => {
    setCatalog(data)
    setError('')
    const reconciled = reconcileChoice(data, useStore.getState().selectedLLM)
    if (!sameChoice(useStore.getState().selectedLLM, reconciled.active)) {
      setSelectedLLM(reconciled.active)
    }
    setSelectedProvider(reconciled.draft.provider)
    setSelectedModel(reconciled.draft.model)
  }, [setSelectedLLM])

  useEffect(() => {
    let active = true
    fetchLLMModels()
      .then(data => {
        if (active) applyCatalog(data)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load LLM providers.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyCatalog])

  useEffect(() => {
    if (modelDownload?.status !== 'success') return
    let active = true
    fetchLLMModels(true)
      .then(data => {
        if (!active) return
        applyCatalog(data)
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to refresh LLM models.')
      })
    return () => {
      active = false
    }
  }, [applyCatalog, modelDownload?.status, modelDownload?.model])

  const providers = useMemo(() => catalog
    ? providersWithOllama(catalog)
    : [{
      provider: OLLAMA_PROVIDER,
      available: false,
      detail: error || 'Waiting for the backend model catalog.',
      models: [],
    }], [catalog, error])
  const provider = providers.find(item => item.provider === selectedProvider)
  const options = optionsFor(provider)
  const selectedOption = options.find(option => option.model.name === selectedModel)
  const downloading = modelDownload?.status === 'downloading'
  const isDownloadingSelected = downloading &&
    modelDownload.provider === selectedProvider &&
    modelDownload.model === selectedModel
  const progress = modelDownload?.progress
  const percentage = progress?.completed != null && progress.total
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : null
  const downloadFailed = modelDownload?.status === 'error' &&
    modelDownload.provider === selectedProvider &&
    modelDownload.model === selectedModel

  function chooseProvider(providerName: string) {
    const nextProvider = providers.find(item => item.provider === providerName)
    setSelectedProvider(providerName)
    if (!nextProvider?.available) {
      setSelectedModel('')
      return
    }

    const choices = optionsFor(nextProvider)
    const current = choices.find(option => option.model.name === selectedModel)
    const preferred = choices.find(option => option.model.name === nextProvider.default_model)
    const next = current || preferred || choices.find(option => !option.downloadable) || choices[0]
    setSelectedModel(next?.model.name || '')
    if (next && !next.downloadable) {
      setSelectedLLM({ provider: providerName, model: next.model.name })
    }
  }

  function chooseModel(modelName: string) {
    setSelectedModel(modelName)
    if (selectedOption?.model.name === modelName && !selectedOption.downloadable) {
      setSelectedLLM({ provider: selectedProvider, model: modelName })
    } else {
      const option = options.find(item => item.model.name === modelName)
      if (option && !option.downloadable) setSelectedLLM({ provider: selectedProvider, model: modelName })
    }
  }

  const emptyMessage = provider && !provider.available
    ? provider.detail || `${provider.provider} is unavailable.`
    : provider && !options.length
      ? 'No models are available for this provider.'
      : ''
  const showDownload = selectedOption?.downloadable && !downloading

  return (
    <div className="flex w-full flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        LLM provider
        <span className="relative">
          <select
            value={selectedProvider}
            disabled={loading || downloading}
            onChange={event => chooseProvider(event.target.value)}
            className={cn(
              'w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50',
              'px-3 py-2 pr-8 text-sm text-zinc-800',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60'
            )}
          >
            {!providers.length && <option value={selectedProvider}>Loading providers…</option>}
            {providers.map(item => (
              <option key={item.provider} value={item.provider} disabled={!item.available}>
                {item.provider}{item.available ? '' : ' (unavailable)'}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Model
        <span className="relative">
          <select
            value={selectedModel}
            disabled={loading || downloading || !provider?.available || options.length === 0}
            onChange={event => chooseModel(event.target.value)}
            className={cn(
              'w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50',
              'px-3 py-2 pr-8 text-sm font-mono text-zinc-800',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60'
            )}
          >
            {!options.length && <option value="">No models available</option>}
            {options.some(option => !option.downloadable) && (
              <optgroup label={selectedProvider === OLLAMA_PROVIDER ? 'Installed' : 'Available'}>
                {options.filter(option => !option.downloadable).map(option => (
                  <option key={option.model.name} value={option.model.name}>{option.model.name}</option>
                ))}
              </optgroup>
            )}
            {options.some(option => option.downloadable) && (
              <optgroup label="Available to install">
                {options.filter(option => option.downloadable).map(option => (
                  <option key={option.model.name} value={option.model.name}>{option.model.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        </span>
      </label>

      {loading && (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading providers and models…
        </span>
      )}
      {emptyMessage && !loading && <p className="text-xs text-amber-700" role="status">{emptyMessage}</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      {selectedOption && !selectedOption.downloadable && (
        <p className="text-xs text-emerald-700" aria-live="polite">
          {selectedProvider === OLLAMA_PROVIDER ? 'Installed' : 'Available'}
          {selectedOption.model.loaded ? ' · Loaded in memory' : ''}
        </p>
      )}
      {selectedOption?.downloadable && !isDownloadingSelected && (
        <p className="text-xs text-amber-700">This Ollama model is available to install.</p>
      )}
      {isDownloadingSelected && (
        <div className="space-y-1" aria-live="polite">
          <progress className="h-1.5 w-full" value={percentage ?? undefined} max={100} />
          <p className="text-xs text-zinc-500">
            {progress?.status || 'Downloading model…'}
            {percentage !== null ? ` (${percentage}%)` : ''}
          </p>
        </div>
      )}
      {showDownload && (
        <button
          type="button"
          disabled={!provider?.available}
          onClick={() => void startModelDownload(selectedProvider, selectedModel)}
          className="self-start rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {downloadFailed ? 'Retry download' : `Install ${selectedModel}`}
        </button>
      )}
      {downloadFailed && (
        <p className="text-xs text-red-600" role="alert">{modelDownload.error}</p>
      )}
    </div>
  )
}
