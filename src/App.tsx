import BingoXGame from './routes/index'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

function App() {
  console.log("App: Launching Bingo X Hub v2.0");

  useEffect(() => {
    // Initialize Edge-to-Edge for Bingo X
    if (Capacitor.isNativePlatform()) {
      import('@capawesome/capacitor-android-edge-to-edge-support').then(({ EdgeToEdge }) => {
        EdgeToEdge.setBackgroundColor({ color: '#00000000' }).catch(err => console.error("EdgeToEdge failed", err));
      }).catch(err => console.error("EdgeToEdge import failed", err));
    }
  }, []);

  return (
    <BingoXGame />
  )
}

export default App
