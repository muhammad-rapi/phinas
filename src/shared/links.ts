/** Public legal pages on the Phinas website (web/, deployed on Vercel). Keep in step with web/lib/site.ts. */
export const LEGAL_URLS = {
  terms: 'https://phinas.vercel.app/terms',
  privacy: 'https://phinas.vercel.app/privacy'
} as const

export type LegalPage = keyof typeof LEGAL_URLS
