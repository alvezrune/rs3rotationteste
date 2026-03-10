import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/variables.css';
import '../styles/global.css';
import './settings.css';
import Settings from './Settings';
import ErrorBoundary from '../components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <Settings />
    </ErrorBoundary>
);
