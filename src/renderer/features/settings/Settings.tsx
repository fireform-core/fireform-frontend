import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Cpu, Globe, Loader2, Plus, Save, Trash2, User } from 'lucide-react'
import { ModelSelector } from '../../components/ModelSelector'
import { Button } from '../../components/ui/button'
import {
  describeLLMError,
  fetchProfile,
  saveProfile,
  type LLMProviderName,
} from '../../lib/api'
import { cn } from '../../lib/utils'
import { useStore } from '../../store'
import { ProviderConfigModal } from './ProviderConfigModal'

function SettingRow({
  label,
  description,
  children,
  disabled,
  badge,
}: {
  label: string
  description: string
  children: React.ReactNode
  disabled?: boolean
  badge?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 py-4 border-b border-zinc-100 last:border-0',
        disabled && 'opacity-50 pointer-events-none select-none'
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">{label}</span>
          {badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="w-full max-w-sm flex-shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-8 first:mt-0">
      <Icon className="w-4 h-4 text-zinc-400" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</span>
    </div>
  )
}

interface CustomFieldRow {
  key: string
  value: string
}

interface ProfileState {
  profile_id?: string
  name: string
  profession: string
  role: string
  description: string
  customFields: CustomFieldRow[]
}

export function Settings() {
  const refreshLLMModels = useStore(state => state.refreshLLMModels)
  const [providersOpen, setProvidersOpen] = useState(false)
  const [initialProvider, setInitialProvider] = useState<LLMProviderName>('ollama')
  const [catalogError, setCatalogError] = useState('')
  const manageProvidersRef = useRef<HTMLButtonElement>(null)
  const modalOpenerRef = useRef<HTMLElement | null>(null)

  const [profile, setProfile] = useState<ProfileState>({
    name: '',
    profession: '',
    role: '',
    description: '',
    customFields: [],
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    refreshLLMModels()
      .then(() => setCatalogError(''))
      .catch(error => setCatalogError(describeLLMError(error)))

    fetchProfile()
      .then(data => {
        if (data) {
          const customFields: CustomFieldRow[] =
            data.custom_fields && typeof data.custom_fields === 'object'
              ? Object.entries(data.custom_fields).map(([key, value]) => ({
                  key,
                  value: String(value ?? ''),
                }))
              : []
          setProfile({
            profile_id: data.profile_id,
            name: data.name || '',
            profession: data.profession || '',
            role: data.role || '',
            description: data.description || '',
            customFields,
          })
        }
      })
      .catch(() => {
        // Keep the empty profile form available if no profile is configured yet.
      })
  }, [refreshLLMModels])

  function openProviders(provider: LLMProviderName = 'ollama', trigger?: HTMLElement) {
    modalOpenerRef.current = trigger || manageProvidersRef.current
    setInitialProvider(provider)
    setProvidersOpen(true)
  }

  function closeProviders() {
    setProvidersOpen(false)
    requestAnimationFrame(() => modalOpenerRef.current?.focus())
  }

  const handleAddCustomField = () => {
    setProfile(prev => ({
      ...prev,
      customFields: [...prev.customFields, { key: '', value: '' }],
    }))
  }

  const handleCustomFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    setProfile(prev => {
      const customFields = [...prev.customFields]
      if (customFields[index]) {
        customFields[index] = { ...customFields[index], [field]: value }
      }
      return { ...prev, customFields }
    })
  }

  const handleRemoveCustomField = (index: number) => {
    setProfile(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingProfile(true)
    setProfileFeedback(null)

    try {
      const custom_fields: Record<string, string> = {}
      for (const item of profile.customFields) {
        if (item.key.trim()) custom_fields[item.key.trim()] = item.value
      }

      const result = await saveProfile({
        profile_id: profile.profile_id,
        name: profile.name,
        profession: profile.profession,
        role: profile.role,
        description: profile.description,
        custom_fields,
      })

      if (result.profile_id) {
        setProfile(prev => ({ ...prev, profile_id: result.profile_id }))
      }
      setProfileFeedback({ type: 'success', text: 'Profile saved successfully!' })
      setTimeout(() => setProfileFeedback(null), 4000)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save profile.'
      setProfileFeedback({ type: 'error', text: message })
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure FireForm and your user profile to match your workflow.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <SectionHeader icon={Cpu} title="AI Model" />
            <Button
              ref={manageProvidersRef}
              type="button"
              variant="outline"
              className="mt-8"
              onClick={event => openProviders('ollama', event.currentTarget)}
            >
              Configure providers
            </Button>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl px-5">
            <SettingRow
              label="LLM provider and model"
              description="Choose from the providers you have set up."
            >
              <ModelSelector
                onConfigure={(provider, trigger) => openProviders(provider, trigger)}
              />
            </SettingRow>
            {catalogError && (
              <p className="pb-3 text-xs text-red-600" role="alert">
                {catalogError}
              </p>
            )}
          </div>
        </div>

        <div>
          <SectionHeader icon={User} title="User Profile" />
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs text-zinc-500">
                FireForm injects your professional role and attributes into the AI context for
                higher-accuracy form fills.
              </p>
            </div>

            {profileFeedback && (
              <div
                className={cn(
                  'mb-4 p-3 rounded-lg text-xs font-medium border flex items-center gap-2',
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                )}
              >
                {profileFeedback.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{profileFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={event => setProfile({ ...profile, name: event.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                    Profession
                  </label>
                  <input
                    type="text"
                    value={profile.profession}
                    onChange={event => setProfile({ ...profile, profession: event.target.value })}
                    placeholder="e.g. Firefighting, Healthcare"
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Role / Title
                </label>
                <input
                  type="text"
                  value={profile.role}
                  onChange={event => setProfile({ ...profile, role: event.target.value })}
                  placeholder="e.g. Battalion Chief, Paramedic"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Bio / Description
                </label>
                <textarea
                  rows={2}
                  value={profile.description}
                  onChange={event => setProfile({ ...profile, description: event.target.value })}
                  placeholder="Brief context or unit info..."
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
                />
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Custom Fields
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="flex items-center gap-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2.5 py-1 rounded-md transition border border-zinc-200"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Field
                  </button>
                </div>

                {profile.customFields.length === 0 && (
                  <p className="text-xs text-zinc-400 italic py-2">
                    No custom fields added yet (e.g. badge_number, station_id).
                  </p>
                )}

                <div className="space-y-2">
                  {profile.customFields.map((field, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Key (e.g. badge_number)"
                        value={field.key}
                        onChange={event =>
                          handleCustomFieldChange(index, 'key', event.target.value)
                        }
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 12345)"
                        value={field.value}
                        onChange={event =>
                          handleCustomFieldChange(index, 'value', event.target.value)
                        }
                        className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(index)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Remove field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white py-2 px-4 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save Profile
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div>
          <SectionHeader icon={Globe} title="Language & Region" />
          <div className="bg-white border border-zinc-200 rounded-xl px-5">
            <SettingRow
              label="UI language"
              description="Change the language used across the FireForm interface."
              disabled
              badge="Coming soon"
            >
              <span className="text-sm text-zinc-400 font-medium">English (EN)</span>
            </SettingRow>
          </div>
        </div>
      </div>
      {providersOpen && (
        <ProviderConfigModal initialProvider={initialProvider} onClose={closeProviders} />
      )}
    </div>
  )
}

export default Settings
