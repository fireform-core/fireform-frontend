import { en, type Translations } from './locales/en'
import { es } from './locales/es'
import type { SupportedLanguage } from '../storage'
import { useStore } from '../../store'

export const translations: Record<SupportedLanguage, Translations> = {
  en,
  es,
}

export function useTranslation() {
  const language = useStore(state => state.language)
  const t = translations[language] || en
  return { t, language }
}

export function getTranslation(language: SupportedLanguage): Translations {
  return translations[language] || en
}

export type { Translations }
