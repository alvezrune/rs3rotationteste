import React from 'react';

const api = window.electronAPI;

export default function TabOverlay({ settings, saveSettings }) {
    if (!settings) return <div className="tab-loading">Carregando...</div>;

    const overlay = settings.overlay || {};
    const sounds = settings.sounds || {};

    const update = (key, value) => {
        const updated = {
            ...settings,
            overlay: { ...settings.overlay, [key]: value },
        };
        saveSettings(updated);
        // Atualizar opacidade em tempo real
        if (key === 'opacity') api.setOpacity(value);
    };

    const updateSound = (key, value) => {
        const updated = {
            ...settings,
            sounds: { ...settings.sounds, [key]: value },
        };
        saveSettings(updated);
    };

    return (
        <div className="tab-overlay">
            {/* Aparência */}
            <div className="settings-section">
                <h3 className="section-label">Aparência</h3>

                <div className="form-row">
                    <div>
                        <div className="form-label">Opacidade</div>
                        <div className="form-desc">Transparência da janela overlay</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="range"
                            min="0.3" max="1" step="0.05"
                            value={overlay.opacity ?? 0.9}
                            onChange={e => update('opacity', parseFloat(e.target.value))}
                        />
                        <span className="range-value">{Math.round((overlay.opacity ?? 0.9) * 100)}%</span>
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Tamanho dos ícones</div>
                    </div>
                    <div className="form-control">
                        <select value={overlay.iconSize || 'medium'} onChange={e => update('iconSize', e.target.value)}>
                            <option value="small">Pequeno</option>
                            <option value="medium">Médio</option>
                            <option value="large">Grande</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Mostrar nome das skills</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="checkbox"
                            checked={overlay.showSkillNames !== false}
                            onChange={e => update('showSkillNames', e.target.checked)}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Skills futuras visíveis</div>
                        <div className="form-desc">Número de slots após a skill atual</div>
                    </div>
                    <div className="form-control">
                        <div className="slot-count-selector">
                            {[2, 3, 4, 5, 6].map(num => (
                                <button
                                    key={num}
                                    className={`slot-count-btn ${(overlay.nextSlotsCount || 4) === num ? 'active' : ''}`}
                                    onClick={() => update('nextSlotsCount', num)}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Velocidade do pulso</div>
                    </div>
                    <div className="form-control">
                        <select value={overlay.pulseSpeed || 'normal'} onChange={e => update('pulseSpeed', e.target.value)}>
                            <option value="slow">Lento</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Rápido</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Comportamento */}
            <div className="settings-section">
                <h3 className="section-label">Comportamento</h3>

                <div className="form-row">
                    <div>
                        <div className="form-label">Piscar overlay ao errar tecla</div>
                        <div className="form-desc">Efeito visual quando a tecla errada é pressionada</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="checkbox"
                            checked={overlay.flashOnError === true}
                            onChange={e => update('flashOnError', e.target.checked)}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Som ao errar tecla</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="checkbox"
                            checked={sounds.onError !== false}
                            onChange={e => updateSound('onError', e.target.checked)}
                        />
                    </div>
                </div>

                {sounds.onError && (
                    <div className="form-row">
                        <div>
                            <div className="form-label">Volume do erro</div>
                        </div>
                        <div className="form-control">
                            <input
                                type="range"
                                min="0" max="1" step="0.1"
                                value={sounds.onError_volume ?? 0.5}
                                onChange={e => updateSound('onError_volume', parseFloat(e.target.value))}
                            />
                            <span className="range-value">{Math.round((sounds.onError_volume ?? 0.5) * 100)}%</span>
                        </div>
                    </div>
                )}

                <div className="form-row">
                    <div>
                        <div className="form-label">Som ao completar fase</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="checkbox"
                            checked={sounds.onPhaseComplete !== false}
                            onChange={e => updateSound('onPhaseComplete', e.target.checked)}
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <div className="form-label">Duração do alerta</div>
                        <div className="form-desc">Tempo antes do alerta sumir (segundos)</div>
                    </div>
                    <div className="form-control">
                        <input
                            type="range"
                            min="2" max="8" step="1"
                            value={(overlay.alertDuration || 4000) / 1000}
                            onChange={e => update('alertDuration', parseInt(e.target.value) * 1000)}
                        />
                        <span className="range-value">{(overlay.alertDuration || 4000) / 1000}s</span>
                    </div>
                </div>
            </div>

            {/* Triggers de mecânica */}
            <div className="settings-section">
                <h3 className="section-label">Triggers de Mecânica (OCR — em breve)</h3>
                <div className="form-desc" style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    Futuramente, será possível configurar alertas automáticos baseados em detecção de texto na tela.
                    Configure triggers para avisar sobre mecânicas específicas dos bosses.
                </div>
            </div>
        </div>
    );
}
