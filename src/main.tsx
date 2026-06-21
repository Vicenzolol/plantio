import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import App from './App';

/* Core CSS — obrigatório para o Ionic funcionar */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* CSS utilitários opcionais do Ionic */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Suporte a tema escuro automático (estilo iOS) */
import '@ionic/react/css/palettes/dark.system.css';

/* Tema da aplicação */
import './theme/variables.css';
import './theme/app.css';

// Força o visual iOS em todos os dispositivos (foco Apple).
setupIonicReact({ mode: 'ios' });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
