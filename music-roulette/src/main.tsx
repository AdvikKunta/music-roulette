import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/lobby/:code', element: <Lobby /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
