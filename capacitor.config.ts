import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nimbus.engineering.crewchief',
  appName: 'Crew Chief',
  webDir: 'dist',

  // Android-specific configuration
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    zoomEnabled: true,
  },

  // Server configuration for development
  server: {
    androidScheme: 'https',
    // Uncomment below for live-reload during development:
    // url: 'http://192.168.x.x:3000',
    // cleartext: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#131313',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },

  // App appearance
  backgroundColor: '#131313',
};

export default config;
