import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import {
  addLLMManualModel,
  deleteLLMManualModel,
  deleteLLMProviderConfig,
  describeLLMError,
  fetchLLMExternalConsent,
  fetchLLMProviderConfigs,
  LLMApiError,
  saveLLMProviderConfig,
  setLLMExternalConsent,
  validateLLMProviderConfig,
  type LLMExternalConsent,
  type LLMProviderConfig,
  type LLMProviderName,
} from '../../lib/api'
import { optionsFor, type LLMModelOption } from '../../lib/llmModels'
import { useStore } from '../../store'
import type { ModelDownloadState } from '../../store'
import type { LLMModelChoice } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/utils'

function endpointIsExternal(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (!host || host === 'localhost' || host === 'host.docker.internal' || /\.(local|internal|lan)$/.test(host)) return false
    if (host.includes(':')) {
      if (host === '::1' || host === '::' || /^(fc|fd)/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return false
      return true
    }
    const octets = host.split('.').map(Number)
    if (octets.length === 4 && octets.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = octets
      if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || a === 0) return false
      return true
    }
    if (!host.includes('.')) return false // Docker service names are local defaults.
    return true
  } catch {
    return true
  }
}

const PROVIDERS: { id: LLMProviderName; name: string }[] = [
  { id: 'ollama', name: 'Ollama' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'llama_cpp', name: 'llama.cpp' },
  { id: 'custom', name: 'Custom server' },
]

type ConfigurableProvider = Exclude<LLMProviderName, 'ollama'>

function ModelRows({
  provider,
  options,
  selectedLLM,
  pinned,
  busy,
  modelDownload,
  onTogglePinned,
  onSelect,
  onDownload,
  onRemoveManual,
}: {
  provider: LLMProviderName
  options: LLMModelOption[]
  selectedLLM: LLMModelChoice | null
  pinned: string[]
  busy: boolean
  modelDownload: ModelDownloadState | null
  onTogglePinned: (model: string) => void
  onSelect: (model: string) => void
  onDownload: (model: string) => void
  onRemoveManual?: (model: string) => void
}) {
  if (!options.length) {
    return <p className="p-4 text-sm text-zinc-500">No matching models found.</p>
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {options.map(option => {
        const isPinned = pinned.includes(option.model.name)
        const inUse = selectedLLM?.provider === provider && selectedLLM.model === option.model.name
        const isDownloading = modelDownload?.status === 'downloading'
          && modelDownload.provider === provider
          && modelDownload.model === option.model.name
        return (
          <li key={option.model.name} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-medium">{option.model.name}</p>
              <p className={cn('mt-1 text-[11px]', option.downloadable ? 'text-amber-700' : 'text-emerald-700')}>
                {option.downloadable ? 'Not installed' : 'Installed'}
                {option.model.loaded ? ' · Loaded in memory' : ''}
                {option.model.manual ? ' · Manual' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={isPinned ? `Unpin ${option.model.name}` : `Pin ${option.model.name}`}
                aria-pressed={isPinned}
                onClick={() => onTogglePinned(option.model.name)}
                className="rounded-md p-2 text-amber-500 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <Star className={cn('h-4 w-4', isPinned && 'fill-current')} aria-hidden="true" />
              </button>
              {option.downloadable ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={modelDownload?.status === 'downloading'}
                  onClick={() => onDownload(option.model.name)}
                >
                  {isDownloading ? 'Downloading…' : 'Download'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={inUse ? 'secondary' : 'default'}
                  onClick={() => onSelect(option.model.name)}
                >
                  {inUse ? 'In use' : 'Use'}
                </Button>
              )}
              {option.model.manual && onRemoveManual && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => onRemoveManual(option.model.name)}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function providerStatus(
  provider: LLMProviderName,
  config: LLMProviderConfig | undefined,
  available: boolean
): string {
  if (provider === 'ollama') return available ? 'Local · connected' : 'Local · unavailable'
  if (!config?.configured) return 'Not configured'
  if (!available) return 'Configured · unavailable'
  if (config.key_hint) return `Key saved · ends in ${config.key_hint}`
  return 'Configured · connected'
}

export function ProviderConfigModal({
  initialProvider,
  onClose,
}: {
  initialProvider: LLMProviderName
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const selectedLLM = useStore(state => state.selectedLLM)
  const catalog = useStore(state => state.llmCatalog)
  const refreshLLMModels = useStore(state => state.refreshLLMModels)
  const setSelectedLLM = useStore(state => state.setSelectedLLM)
  const pinnedLLMModels = useStore(state => state.pinnedLLMModels)
  const setPinnedLLMModels = useStore(state => state.setPinnedLLMModels)
  const startModelDownload = useStore(state => state.startModelDownload)
  const modelDownload = useStore(state => state.modelDownload)
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderName>(initialProvider)
  const [configs, setConfigs] = useState<LLMProviderConfig[]>([])
  const [consent, setConsent] = useState<LLMExternalConsent | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrlOverride, setBaseUrlOverride] = useState<string | null>(null)
  const [structuredOutputOverride, setStructuredOutputOverride] = useState<boolean | null>(null)
  const [modelSearch, setModelSearch] = useState('')
  const [pinnedModelsExpanded, setPinnedModelsExpanded] = useState(true)
  const [allModelsExpanded, setAllModelsExpanded] = useState(true)
  const [manualModel, setManualModel] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([fetchLLMProviderConfigs(), fetchLLMExternalConsent(), refreshLLMModels()])
      .then(([nextConfigs, nextConsent]) => {
        if (!active) return
        setConfigs(nextConfigs)
        setConsent(nextConsent)
      })
      .catch(err => {
        if (active) setError(describeLLMError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshLLMModels])

  const config = configs.find(item => item.provider === selectedProvider)
  const isOpenAICompatible = selectedProvider === 'custom' || selectedProvider === 'llama_cpp'
  const baseUrl = baseUrlOverride ?? (isOpenAICompatible ? config?.base_url : undefined) ?? ''
  const structuredOutput = structuredOutputOverride ?? (isOpenAICompatible ? config?.structured_output : undefined) ?? true
  const providerModels = catalog?.providers.find(item => item.provider === selectedProvider)
  const options = optionsFor(providerModels)
  const providerFailure = providerModels?.error_code
    ? describeLLMError(new LLMApiError(providerModels.detail || 'Provider is unavailable.', providerModels.error_code))
    : providerModels?.detail
  const search = modelSearch.trim().toLowerCase()
  const visibleModels = options.filter(option => option.model.name.toLowerCase().includes(search))
  const pinnedModels = pinnedLLMModels[selectedProvider] || []
  const hasPinnedModels = options.some(option => pinnedModels.includes(option.model.name))
  const visiblePinnedModels = visibleModels.filter(option => pinnedModels.includes(option.model.name))
  const pinnedModelsAreExpanded = pinnedModelsExpanded || Boolean(search)
  const allModelsAreExpanded = allModelsExpanded || Boolean(search)
  const selectedSummary = selectedLLM
    ? `${selectedLLM.provider} · ${selectedLLM.model}`
    : 'No model selected'
  const isExternal = isOpenAICompatible
    ? (baseUrlOverride === null ? Boolean(config?.external) : endpointIsExternal(baseUrl))
    : selectedProvider !== 'ollama'
  const consentRequired = isExternal && !consent?.allow_external
  const manualModels = providerModels?.models.filter(model => model.manual) || []

  function handleClose() {
    setApiKey('')
    onClose()
  }

  async function reloadAfterChange() {
    const [nextConfigs, nextConsent] = await Promise.all([
      fetchLLMProviderConfigs(),
      fetchLLMExternalConsent(),
    ])
    setConfigs(nextConfigs)
    setConsent(nextConsent)
    await refreshLLMModels(true)
  }

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (err) {
      setError(describeLLMError(err))
    } finally {
      setBusy(false)
    }
  }

  async function validateProvider() {
    if (selectedProvider === 'ollama') return
    const provider = selectedProvider as ConfigurableProvider
    const request = {
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(isOpenAICompatible
        ? { base_url: baseUrl, structured_output: structuredOutput }
        : {}),
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await validateLLMProviderConfig(provider, request)
      if (!result.ok) {
        throw new LLMApiError(result.detail || 'Provider validation failed.', result.error_code || undefined)
      }
      setMessage(`Connection validated. ${result.models.length} model${result.models.length === 1 ? '' : 's'} found.`)
    } catch (err) {
      setError(describeLLMError(err))
    } finally {
      setApiKey('')
      setBusy(false)
    }
  }

  async function saveProvider() {
    if (selectedProvider === 'ollama') return
    const provider = selectedProvider as ConfigurableProvider
    const request = {
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(isOpenAICompatible
        ? { base_url: baseUrl, structured_output: structuredOutput }
        : {}),
    }
    await runAction(async () => {
      let enabledConsent = false
      const enableConsent = async () => {
        setConsent(await setLLMExternalConsent(true))
        enabledConsent = true
        await refreshLLMModels(true)
      }
      const hasOtherExternalProvider = () => configs.some(item =>
        item.provider !== provider && item.external && item.configured
      )

      try {
        if (isExternal && !consent?.allow_external) await enableConsent()
        try {
          await saveLLMProviderConfig(provider, request)
        } catch (error) {
          if (
            isOpenAICompatible
            && !enabledConsent
            && !consent?.allow_external
            && error instanceof LLMApiError
            && error.code === 'LLM_EXTERNAL_CONSENT_REQUIRED'
          ) {
            await enableConsent()
            await saveLLMProviderConfig(provider, request)
          } else {
            throw error
          }
        }
      } catch (error) {
        if (enabledConsent && !hasOtherExternalProvider()) {
          try {
            setConsent(await setLLMExternalConsent(false))
            await refreshLLMModels(true)
          } catch (rollbackError) {
            throw new Error(
              `${describeLLMError(error)} Consent rollback failed: ${describeLLMError(rollbackError)}`
            )
          }
        }
        throw error
      }
      await reloadAfterChange()
    }, 'Provider configuration saved.')
    setApiKey('')
  }

  async function removeProvider() {
    if (selectedProvider === 'ollama') return
    const provider = selectedProvider as ConfigurableProvider
    const removedExternalConfig = config?.external === true
    await runAction(async () => {
      await deleteLLMProviderConfig(provider)
      const nextConfigs = await fetchLLMProviderConfigs()
      let nextConsent = await fetchLLMExternalConsent()
      if (
        removedExternalConfig
        &&
        nextConsent.source === 'ui'
        && !nextConfigs.some(item => item.external && item.configured)
      ) {
        nextConsent = await setLLMExternalConsent(false)
      }
      setConfigs(nextConfigs)
      setConsent(nextConsent)
      await refreshLLMModels(true)
      setApiKey('')
      setBaseUrlOverride(null)
      setStructuredOutputOverride(null)
    }, 'Provider configuration removed.')
  }

  async function testAndAddModel() {
    if (selectedProvider === 'ollama') return
    const provider = selectedProvider as ConfigurableProvider
    const candidate = manualModel.trim()
    if (!candidate) return
    await runAction(async () => {
      const result = await addLLMManualModel(provider, candidate)
      if (!result.ok) {
        throw new LLMApiError(result.detail || 'Model validation failed.', result.error_code || undefined)
      }
      setManualModel('')
      await reloadAfterChange()
    }, `Model ${candidate} validated and added.`)
  }

  async function removeManualModel(model: string) {
    if (selectedProvider === 'ollama') return
    const provider = selectedProvider as ConfigurableProvider
    await runAction(async () => {
      await deleteLLMManualModel(provider, model)
      await refreshLLMModels(true)
    }, `Model ${model} removed.`)
  }

  function selectProvider(provider: LLMProviderName) {
    setApiKey('')
    setError('')
    setMessage('')
    setModelSearch('')
    setPinnedModelsExpanded(true)
    setAllModelsExpanded(true)
    setSelectedProvider(provider)
    setBaseUrlOverride(null)
    setStructuredOutputOverride(null)
  }

  function togglePinned(model: string) {
    const current = pinnedLLMModels[selectedProvider] || []
    setPinnedLLMModels(
      selectedProvider,
      current.includes(model) ? current.filter(item => item !== model) : [...current, model]
    )
  }

  const statusRows = PROVIDERS.map(item => {
    const status = configs.find(entry => entry.provider === item.id)
    const available = item.id === 'ollama'
      ? Boolean(catalog?.providers.find(entry => entry.provider === item.id)?.available)
      : Boolean(catalog?.providers.find(entry => entry.provider === item.id)?.available)
    return { ...item, config: status, available, statusText: providerStatus(item.id, status, available) }
  })

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="provider-config-title"
      className="m-auto h-[min(88vh,760px)] w-[min(1120px,calc(100vw-32px))] max-w-none overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/50"
      onCancel={event => {
        event.preventDefault()
        handleClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) handleClose()
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 id="provider-config-title" className="text-base font-semibold">Configure AI providers</h2>
            <p className="mt-1 text-xs text-zinc-500">Choose a provider and manage its models.</p>
          </div>
          <Button type="button" variant="outline" onClick={handleClose} autoFocus aria-label="Close provider configuration">
            Close
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-zinc-200 bg-zinc-50 md:border-b-0 md:border-r">
            <nav aria-label="LLM providers" className="space-y-1 overflow-y-auto p-3">
              {statusRows.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={selectedProvider === item.id ? 'true' : undefined}
                  onClick={() => selectProvider(item.id)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                    selectedProvider === item.id
                      ? 'border-violet-200 bg-white shadow-sm'
                      : 'border-transparent hover:bg-white'
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        item.available ? 'bg-emerald-500' : item.config?.configured ? 'bg-amber-500' : 'bg-zinc-300'
                      )}
                      aria-label={item.available ? 'Available' : 'Unavailable'}
                    />
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-zinc-500">{item.statusText}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto border-t border-zinc-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current selection</p>
              <p className="mt-1 break-words text-xs font-medium text-zinc-700">Filling forms with {selectedSummary}</p>
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-5 md:p-7" aria-label={`${selectedProvider} configuration`}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">
                  {isExternal ? 'External service' : 'Local provider'}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {PROVIDERS.find(item => item.id === selectedProvider)?.name}
                </h3>
                {selectedProvider !== 'ollama' && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {config?.key_hint
                      ? `Saved key · ends in ${config.key_hint}`
                      : config?.configured
                        ? 'Configured without a saved API key'
                        : 'No API key configured'}
                  </p>
                )}
              </div>
              {loading && <span className="text-xs text-zinc-500">Loading provider settings…</span>}
            </div>

            {selectedProvider !== 'ollama' && (
              <div className="mb-5 space-y-3 rounded-xl border border-zinc-200 p-4">
                {isOpenAICompatible && (
                  <>
                    <label className="block text-xs font-medium text-zinc-700" htmlFor="custom-base-url">
                      Base URL
                      <Input
                        id="custom-base-url"
                        className="mt-1"
                        value={baseUrl}
                        onChange={event => setBaseUrlOverride(event.target.value)}
                        placeholder="http://localhost:1234/v1"
                        autoComplete="url"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={structuredOutput}
                        onChange={event => setStructuredOutputOverride(event.target.checked)}
                      />
                      Use structured output
                    </label>
                    <p className="text-[11px] text-zinc-500">
                      In Docker, use <code>host.docker.internal</code> to reach a server on your computer. Adding a model manually is the usual setup.
                    </p>
                  </>
                )}

                <label className="block text-xs font-medium text-zinc-700" htmlFor="provider-api-key">
                  API key
                  <Input
                    id="provider-api-key"
                    className="mt-1 font-mono"
                    type="password"
                    autoComplete="off"
                    name="provider-api-key"
                    value={apiKey}
                    onChange={event => setApiKey(event.target.value)}
                    placeholder={config?.key_hint ? `Saved key · ends in ${config.key_hint}` : selectedProvider === 'llama_cpp' ? 'Optional; usually not required' : 'Enter API key'}
                  />
                </label>
                {isExternal && (
                  <p className="text-xs text-amber-800" role="note">
                    {PROVIDERS.find(item => item.id === selectedProvider)?.name} is an external service. Incident text leaves this computer when you fill a form.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || consentRequired || (!isOpenAICompatible && !apiKey)}
                    onClick={() => void validateProvider()}
                  >
                    {busy ? 'Working…' : 'Validate'}
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      busy
                      || (isOpenAICompatible && !baseUrl.trim())
                      || (!isOpenAICompatible && !apiKey && !config?.configured)
                    }
                    onClick={() => void saveProvider()}
                  >
                    {isExternal && !consent?.allow_external
                      ? `Save and allow sending data to ${PROVIDERS.find(item => item.id === selectedProvider)?.name}`
                      : 'Save'}
                  </Button>
                  {config?.source === 'ui' && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void removeProvider()}>
                      Remove configuration
                    </Button>
                  )}
                </div>
                {config?.source === 'env' && (
                  <p className="text-[11px] text-zinc-500">This provider is configured by the FireForm server environment.</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-xs font-medium text-zinc-700" htmlFor="provider-model-search">
                Search models
                <Input
                  id="provider-model-search"
                  className="mt-1"
                  value={modelSearch}
                  onChange={event => setModelSearch(event.target.value)}
                  placeholder={selectedProvider === 'ollama' ? 'Search installed or downloadable models' : 'Search available models'}
                />
              </label>

              {hasPinnedModels && (
                <section className="overflow-hidden rounded-xl border border-zinc-200" aria-label="Pinned models">
                  <button
                    type="button"
                    aria-expanded={pinnedModelsAreExpanded}
                    onClick={() => setPinnedModelsExpanded(expanded => !expanded)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                  >
                    Pinned
                    <ChevronDown className={cn('h-4 w-4 transition-transform', pinnedModelsAreExpanded && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {pinnedModelsAreExpanded && (
                    <div className="max-h-72 overflow-y-auto border-t border-zinc-100">
                      <ModelRows
                        provider={selectedProvider}
                        options={visiblePinnedModels}
                        selectedLLM={selectedLLM}
                        pinned={pinnedModels}
                        busy={busy}
                        modelDownload={modelDownload}
                        onTogglePinned={togglePinned}
                        onSelect={model => setSelectedLLM({ provider: selectedProvider, model })}
                        onDownload={model => void startModelDownload('ollama', model)}
                        onRemoveManual={selectedProvider === 'ollama' ? undefined : model => void removeManualModel(model)}
                      />
                    </div>
                  )}
                </section>
              )}

              <section className="overflow-hidden rounded-xl border border-zinc-200" aria-label="All models">
                <button
                  type="button"
                  aria-expanded={allModelsAreExpanded}
                  onClick={() => setAllModelsExpanded(expanded => !expanded)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  All models ({options.length})
                  <ChevronDown className={cn('h-4 w-4 transition-transform', allModelsAreExpanded && 'rotate-180')} aria-hidden="true" />
                </button>
                {allModelsAreExpanded && (
                  <div className="max-h-72 overflow-y-auto border-t border-zinc-100">
                    {visibleModels.length ? (
                      <ModelRows
                        provider={selectedProvider}
                        options={visibleModels}
                        selectedLLM={selectedLLM}
                        pinned={pinnedModels}
                        busy={busy}
                        modelDownload={modelDownload}
                        onTogglePinned={togglePinned}
                        onSelect={model => setSelectedLLM({ provider: selectedProvider, model })}
                        onDownload={model => void startModelDownload('ollama', model)}
                        onRemoveManual={selectedProvider === 'ollama' ? undefined : model => void removeManualModel(model)}
                      />
                    ) : (
                      <p className="p-4 text-sm text-zinc-500">
                        {providerModels?.available
                          ? 'No matching models found.'
                          : providerFailure || (selectedProvider === 'ollama'
                            ? 'Ollama is not connected.'
                            : 'Save and validate this provider to load its models.')}
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            {selectedProvider !== 'ollama' && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="manual-model-id" className="sr-only">Add a model manually</label>
                  <Input
                    id="manual-model-id"
                    value={manualModel}
                    onChange={event => setManualModel(event.target.value)}
                    placeholder="Add a model manually"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !manualModel.trim() || !config?.configured || consentRequired}
                    onClick={() => void testAndAddModel()}
                  >
                    Test and add
                  </Button>
                </div>
                {manualModels.length > 0 && <p className="text-[11px] text-zinc-500">Manual models are tested by the server before they are added.</p>}
              </div>
            )}

            {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</p>}
            {message && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status">{message}</p>}
          </section>
        </div>
      </div>
    </dialog>
  )
}
