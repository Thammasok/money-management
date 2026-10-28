import '@fontsource-variable/newsreader';
import '@fontsource-variable/source-sans-3';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { createServices } from './services/create-services';
import { ServiceProvider } from './services/ServiceContext';
import { SessionProvider } from './session/SessionProvider';
import './styles/theme.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing the #root element');
}

// Composition root: real services → who is signed in → routes.
createRoot(container).render(
  <StrictMode>
    <ServiceProvider services={createServices()}>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </ServiceProvider>
  </StrictMode>,
);
