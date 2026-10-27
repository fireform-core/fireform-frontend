import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import {
  describeLLMError,
  type LLMModelChoice,
  type LLMProviderName,
} from '../lib/api'
import { defaultChoice, optionsFor, providersWithOllama } from '../lib/llmModels'
import { cn } from '../lib/utils'

export function ModelSelector({
  onConfigure,
  showHelpText = true,
}: {
  onConfigure?: (provider: LLMProviderName, trigger: HTMLElement) => void
  showHelpText?: boolean
} = {}) {
  const selectedLLM = useStore(state => state.selectedLLM)
  const setSelectedLLM = useStore(state => state.setSelectedLLM)
  const catalog = useStore(state => state.llmCatalog)
  const pinnedLLMModels = useStore(state => state.pinnedLLMModels)
  const refreshLLMModels = useStore(state => state.refreshLLMModels)
  const modelDownload = useStore(state => state.modelDownload)
  const startModelDownload = useStore(state => state.startModelDownload)
  const [draft, setDraft] = useState<{
    choice: LLMModelChoice
    catalog: typeof catalog
    selectionKey: string
  } | null>(null)
  const [loadFinished, setLoadFinished] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (catalog) return
    let active = true
    refreshLLMModels()
      .then(() => {
        if (active) setError('')
      })
      .catch(err => {
        if (active) setError(describeLLMError(err))
      })
      .finally(() => {
        if (active) setLoadFinished(true)
      })
    return () => {
      active = false
    }
  }, [catalog, refreshLLMModels])

  const loading = !catalog && !loadFinished
  const providers = useMemo(() => catalog
    ? providersWithOllama(catalog).filter(item => item.available)
    : [], [catalog])
  const selectionKey = selectedLLM ? `${selectedLLM.provider}\u0000${selectedLLM.model}` : ''
  const draftChoice = draft?.catalog === catalog && draft.selectionKey === selectionKey
    ? draft.choice
    : null
  const baseChoice = selectedLLM || (catalog ? defaultChoice(catalog) : null)
  const selectedProvider = draftChoice?.provider || baseChoice?.provider || 'ollama'
  const selectedModel = draftChoice?.model || baseChoice?.model || ''
  const provider = providers.find(item => item.provider === selectedProvider)
  const options = optionsFor(provider)
  const quickOptions = options.filter(option =>
    option.model.name === provider?.default_model
    || (selectedLLM?.provider === selectedProvider && option.model.name === selectedLLM.model)
    || option.model.manual === true
    || (pinnedLLMModels[selectedProvider as LLMProviderName] || []).includes(option.model.name)
  )
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
    if (!nextProvider?.available) {
      return
    }

    const choices = optionsFor(nextProvider)
    const current = choices.find(option => option.model.name === selectedModel)
    const preferred = choices.find(option => option.model.name === nextProvider.default_model)
    const next = current || preferred || choices.find(option => !option.downloadable) || choices[0]
    const choice = { provider: providerName, model: next?.model.name || '' }
    if (next && !next.downloadable) {
      setSelectedLLM(choice)
      setDraft({
        choice,
        catalog,
        selectionKey: `${choice.provider}\u0000${choice.model}`,
      })
    } else {
      setDraft({ choice, catalog, selectionKey })
    }
  }

  function chooseModel(modelName: string, trigger: HTMLElement) {
    if (modelName === '__fireform_more_models__') {
      onConfigure?.(selectedProvider as LLMProviderName, trigger)
      return
    }
    const choice = { provider: selectedProvider, model: modelName }
    const option = options.find(item => item.model.name === modelName)
    if (option && !option.downloadable) {
      setSelectedLLM(choice)
      setDraft({
        choice,
        catalog,
        selectionKey: `${choice.provider}\u0000${choice.model}`,
      })
    } else {
      setDraft({ choice, catalog, selectionKey })
    }
  }

  const emptyMessage = provider && !provider.available
    ? provider.detail || `${provider.provider} is unavailable.`
    : catalog && !providers.length
      ? 'No providers are configured and available.'
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
            {!providers.length && (
              <option value={selectedProvider}>{loading ? 'Loading providers…' : 'No available providers'}</option>
            )}
            {providers.map(item => (
              <option key={item.provider} value={item.provider}>{item.provider}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        </span>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Model
        <span className="relative">
          <select
            value={quickOptions.some(option => option.model.name === selectedModel) ? selectedModel : ''}
            disabled={loading || downloading || !provider?.available}
            onChange={event => chooseModel(event.target.value, event.currentTarget)}
            className={cn(
              'w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50',
              'px-3 py-2 pr-8 text-sm font-mono text-zinc-800',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60'
            )}
          >
            {!quickOptions.length && <option value="">No models available</option>}
            {quickOptions.some(option => !option.downloadable) && (
              <optgroup label={selectedProvider === 'ollama' ? 'Installed' : 'Available'}>
                {quickOptions.filter(option => !option.downloadable).map(option => (
                  <option key={option.model.name} value={option.model.name}>{option.model.name}</option>
                ))}
              </optgroup>
            )}
            {quickOptions.some(option => option.downloadable) && (
              <optgroup label="Available to install">
                {quickOptions.filter(option => option.downloadable).map(option => (
                  <option key={option.model.name} value={option.model.name}>{option.model.name}</option>
                ))}
              </optgroup>
            )}
            {onConfigure && <option value="__fireform_more_models__">More models…</option>}
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
      {showHelpText && (
        <p className="text-[11px] text-zinc-500">
          Choose from the providers you have set up.
          {onConfigure && (
            <>
              {' '}
              <button
                type="button"
                onClick={event => onConfigure(selectedProvider as LLMProviderName, event.currentTarget)}
                className="font-medium text-violet-700 hover:underline"
              >
                Configure…
              </button>
            </>
          )}
        </p>
      )}

      {selectedOption && !selectedOption.downloadable && (
        <p className="text-xs text-emerald-700" aria-live="polite">
          {selectedProvider === 'ollama' ? 'Installed' : 'Available'}
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
