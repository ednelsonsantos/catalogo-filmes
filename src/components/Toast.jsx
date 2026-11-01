import React, { useEffect } from 'react'

export default function Toast({ message, type = 'success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [])
  const colors = {
    success: { bg: 'var(--toast-ok-bg)', border: 'var(--toast-ok-border)', text: 'var(--toast-ok-text)' },
    error:   { bg: 'var(--toast-err-bg)', border: 'var(--toast-err-border)', text: 'var(--toast-err-text)' },
    info:    { bg: 'var(--toast-info-bg)', border: 'var(--toast-info-border)', text: 'var(--toast-info-text)' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'slideUp 0.2s ease', maxWidth: 320,
    }}>
      {message}
      <style>{`@keyframes slideUp { from { transform: translateY(10px); opacity:0 } to { transform: none; opacity:1 } }`}</style>
    </div>
  )
}
