import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 20,
                    color: '#EF4444',
                    background: '#08090f',
                    fontFamily: 'Rajdhani, sans-serif',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}>
                    <div style={{ fontSize: 24 }}>⚠️</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Erro no componente</div>
                    <div style={{ fontSize: 11, color: '#8892A4', maxWidth: 300, textAlign: 'center' }}>
                        {this.state.error?.message || 'Erro desconhecido'}
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            marginTop: 8, padding: '6px 16px',
                            background: 'rgba(200,168,75,0.15)',
                            border: '1px solid rgba(200,168,75,0.5)',
                            borderRadius: 6, color: '#C8A84B',
                            fontFamily: 'Rajdhani, sans-serif',
                            fontWeight: 700, cursor: 'pointer',
                        }}
                    >
                        ↺ Tentar Novamente
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
