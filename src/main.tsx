import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'

// Adicione este bloco para registrar o SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registrado com sucesso:', registration.scope);
      })
      .catch((err) => {
        console.log('Falha ao registrar SW:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)