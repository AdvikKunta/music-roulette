import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Submissions from './pages/Submissions';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/lobby/:code', element: <Lobby /> },
  { path: '/submit/:code', element: <Submissions /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
