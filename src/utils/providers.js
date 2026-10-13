// Cache do "Onde assistir" salvo no banco (coluna providers, JSON). null = nunca verificado
export function parseProviders(filme) {
  if (!filme?.providers) return null
  try { return JSON.parse(filme.providers) } catch { return null }
}

export const providerLogo = (p, size = 'w45') => `https://image.tmdb.org/t/p/${size}${p.logo}`
