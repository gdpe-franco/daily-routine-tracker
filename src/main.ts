import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
createApp(App).mount('#app')
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))
