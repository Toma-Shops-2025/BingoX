/// <reference types="@capawesome/capacitor-android-edge-to-edge-support" />

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fun.mybingox',
  appName: 'Bingo X',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SystemBars: {
      // Let @capawesome/capacitor-android-edge-to-edge-support own WebView insets.
      insetsHandling: 'disable',
    },
    EdgeToEdge: {
      backgroundColor: '#050515',
    },
  },
};

export default config;
