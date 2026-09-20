import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import FlyFourApp from './FlyFourApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FlyFourApp />
  </StrictMode>,
)
