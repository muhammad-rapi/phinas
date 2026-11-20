/** Public legal pages (built in the web sub-project). */
export const LEGAL_URLS = {
  terms: 'https://muhammad-rapi.github.io/phinas/terms',
  privacy: 'https://muhammad-rapi.github.io/phinas/privacy'
} as const

export type LegalPage = keyof typeof LEGAL_URLS
