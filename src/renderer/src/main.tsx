import { createRoot } from 'react-dom/client'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import { App } from './App'
import './styles.css'

if (navigator.userAgent.includes('Mac')) document.documentElement.dataset.platform = 'mac'

createRoot(document.getElementById('root')!).render(<App />)
