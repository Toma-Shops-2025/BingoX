import BingoXGame from './routes/index'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Toaster } from 'sonner'

function App() {
  console.log("App: Launching Bingo X Hub v2.1");

  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      import('@capawesome/capacitor-android-edge-to-edge-support').then(({ EdgeToEdge }) => {
        EdgeToEdge.enable().catch((err) => console.error('EdgeToEdge.enable failed', err));
      }).catch((err) => console.error('EdgeToEdge import failed', err));
    }
  }, []);

  return (
    <>
      <BingoXGame />
      <Toaster position="top-center" richColors theme="dark" />
    </>
  )
}

export default App
