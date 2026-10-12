import React, { useState, useRef } from 'react'

// Área da capa (clique ou arraste uma foto) + status do OCR local
export default function CoverPicker({ coverPreview, onImageFile, ocrStatus, ocrMessage, ocrProgress }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef()

  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onImageFile(file)
  }

  return (
    <>
      <div
        className={`cover-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        {coverPreview
          ? <img src={coverPreview} alt="capa" className="cover-img" />
          : <div className="cover-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Capa do filme</span>
            </div>
        }
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => onImageFile(e.target.files?.[0])} />
      </div>

      {ocrStatus && (
        <div className={`ai-status ${ocrStatus}`}>
          {ocrStatus === 'loading' && <span className="ai-spin"/>}
          {ocrStatus === 'done'    && <span>✓</span>}
          {ocrStatus === 'error'   && <span>⚠</span>}
          <div style={{ flex: 1 }}>
            <span>{ocrMessage}</span>
            {ocrStatus === 'loading' && ocrProgress > 0 && (
              <div style={{ marginTop: 6, height: 3, background: 'rgba(74,158,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--blue)', transition: 'width 0.3s' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
