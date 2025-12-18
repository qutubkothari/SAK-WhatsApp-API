import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { isDebugEnabled } from './utils/debug'

if (isDebugEnabled()) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__SAK_DEBUG__ = true
  // eslint-disable-next-line no-console
  console.log('[SAK] Debug enabled', { href: window.location.href, mode: import.meta.env.MODE })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
