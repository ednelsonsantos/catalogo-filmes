import React, { useEffect } from 'react'

export default function Toast({ message, type = 'success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [])
  const colors = {
    success: { bg: '#1a2e1a', border: '#2d5a2d', text: '#6fcf7a' },
    error:   { bg: '#2e1a1a', border: '#5a2d2d', text: '#cf6f6f' },
    info:    { bg: '#1a1e2e', border: '#2d3a5a', text: '#6f9fcf' },
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
