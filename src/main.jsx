import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import App from './App';
import './styles.css';

const appNode = (
  <>
    <CssBaseline />
    <App />
  </>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  import.meta.env.DEV ? appNode : <React.StrictMode>{appNode}</React.StrictMode>,
);
