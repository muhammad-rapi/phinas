import { createRoot } from 'react-dom/client'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import { Notch } from './Notch'
import './notch.css'

createRoot(document.getElementById('root')!).render(<Notch />)
