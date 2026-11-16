import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import { App } from './App'
import './styles.css'

if (navigator.userAgent.includes('Mac')) document.documentElement.dataset.platform = 'mac'

createRoot(document.getElementById('root')!).render(<App />)
