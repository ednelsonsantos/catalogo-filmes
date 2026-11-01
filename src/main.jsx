import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Tema resolvido pelo processo principal (escuro / claro / o do Windows); muda na hora quando troca
const applyTheme = ({ dark } = {}) => { document.documentElement.dataset.theme = dark === false ? 'light' : 'dark' }
window.api?.onThemeChanged?.(applyTheme)
window.api?.themeGet?.().then(applyTheme).catch(() => {})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
