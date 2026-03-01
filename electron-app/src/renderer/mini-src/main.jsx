import React from 'react';
import { createRoot } from 'react-dom/client';
import MiniTimer from './MiniTimer.jsx';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MiniTimer />
  </React.StrictMode>
);
