import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../design/design-tokens.css';
import './stile.css';
import { App } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
