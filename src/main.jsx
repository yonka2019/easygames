import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.jsx'
import { byId } from './games/registry'

// Deep link to a game: fetch its chunk before the first render, so the page never swaps a
// loading placeholder for the game (a height snap).
const deep = byId(window.location.hash.match(/^#\/g\/([\w-]+)\/?$/)?.[1])

Promise.resolve(deep?.Component.preload?.())
  .catch(() => {})
  .then(() =>
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
