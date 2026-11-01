import { useState, useEffect } from 'react'

// Imagem do título: a capa própria (foto) > o pôster guardado no disco > o link do pôster (até ser baixado)
export function usePosterSrc(filme) {
  const [src, setSrc] = useState(null)
  const id = filme?.id
  const coverPath = filme?.cover_path
  const posterUrl = filme?.poster_url && filme.poster_url !== 'N/A' ? filme.poster_url : ''

  useEffect(() => {
    let cancelled = false
    setSrc(null) // ao trocar de título (setas do detalhe), não fica a imagem do anterior
    const load = async () => {
      if (coverPath) {
        const data = await window.api.readCover(coverPath)
        if (data) { if (!cancelled) setSrc(data); return }
      }
      if (!posterUrl) return
      const saved = id ? await window.api.readPoster(id, posterUrl).catch(() => null) : null
      if (!cancelled) setSrc(saved || posterUrl)
    }
    load()
    return () => { cancelled = true }
  }, [id, coverPath, posterUrl])

  return src
}
