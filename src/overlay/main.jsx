import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/variables.css';
import '../styles/global.css';
import './overlay.css';
import Overlay from './Overlay';
import ErrorBoundary from '../components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <Overlay />
    </ErrorBoundary>
);
