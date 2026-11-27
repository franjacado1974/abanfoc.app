import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import EditorDwg from './EditorDwg';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorDwg />
  </StrictMode>
);
