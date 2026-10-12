import { createWorker } from 'tesseract.js'

// Palavras comuns em capas de disco que não fazem parte do título
const DISC_NOISE = /\b(blu[\s-]?ray|dvd|4k[\s-]?uhd|uhd|vhs|digital|dolby|atmos|dts|imax|3d|hdr|remaster(ed)?|edition|collection|uncut|extended|theatrical|director['s]*\s*cut|special\s*features?|bonus|disc|disk|widescreen|fullscreen|aspect\s*ratio|region|ntsc|pal)\b/gi

export async function extractTitleFromImage(file, onProgress) {
  const worker = await createWorker(['por', 'eng'], 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)) },
  })
  const { data } = await worker.recognize(file)
  await worker.terminate()

  const candidates = data.lines
    .filter(l => l.text.trim().length > 1 && l.text.trim().length < 80)
    .map(l => {
      const cleaned = l.text.trim().replace(DISC_NOISE, '').replace(/\s+/g, ' ').trim()
      return {
        text: cleaned,
        score: l.words.reduce((s, w) => s + w.confidence, 0) / (l.words.length || 1),
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      }
    })
    .filter(l => l.text.length > 1 && l.score > 40 && !/^[\d\s\W]+$/.test(l.text))
    .sort((a, b) => {
      const aFit = a.wordCount >= 1 && a.wordCount <= 6 ? 1 : 0
      const bFit = b.wordCount >= 1 && b.wordCount <= 6 ? 1 : 0
      return (bFit - aFit) || (b.score - a.score)
    })

  // Retorna os 3 melhores candidatos para tentativas progressivas
  return candidates.slice(0, 3).map(c => c.text)
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}
