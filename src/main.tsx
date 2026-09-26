import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { Layout } from './components/Layout'
import { Intro } from './components/Intro'
import { ToastProvider } from './components/ui'
import Dashboard from './pages/Dashboard'
import LogWorkout from './pages/LogWorkout'
import Workouts from './pages/Workouts'
import Stats from './pages/Stats'
import CheckInPage from './pages/CheckIn'
import Photos from './pages/Photos'
import Programme from './pages/Programme'
import SettingsPage from './pages/Settings'

function App() {
  const [intro, setIntro] = useState(() => {
    try { return !sessionStorage.getItem('forge.booted') } catch { return true }
  })
  const done = useCallback(() => {
    try { sessionStorage.setItem('forge.booted', '1') } catch { /* ignore */ }
    setIntro(false)
  }, [])

  return (
    <ToastProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/log" element={<LogWorkout />} />
            <Route path="/log/:id" element={<LogWorkout />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/:id" element={<Workouts />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/checkin" element={<CheckInPage />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/programme" element={<Programme />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </HashRouter>
      {intro && <Intro onDone={done} />}
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
