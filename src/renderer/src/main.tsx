import { createRoot } from 'react-dom/client'
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import { App } from './App'
import './theme/tokens.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/lists.css'
import './styles/home.css'
import './styles/explore.css'
import './styles/profile.css'
import './styles/social.css'
import './styles/covers.css'
import { DARK_QUERY, browserStorage, readMode, resolveMode } from './theme/mode'

if (navigator.userAgent.includes('Mac')) document.documentElement.dataset.platform = 'mac'
// Set before React renders so a Malam window never flashes Siang paper.
document.documentElement.dataset.theme = resolveMode(readMode(browserStorage()), window.matchMedia(DARK_QUERY).matches)

createRoot(document.getElementById('root')!).render(<App />)
