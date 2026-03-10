import React, { useState, useEffect } from 'react';
import TabRotacao from './tabs/TabRotacao';
import TabAbilities from './tabs/TabAbilities';
import TabKeybinds from './tabs/TabKeybinds';
import TabIcones from './tabs/TabIcones';
import TabOverlay from './tabs/TabOverlay';

const api = window.electronAPI;

const TABS = [
    { id: 'rotacao', label: 'ROTAÇÃO', icon: '⚔' },
    { id: 'abilities', label: 'ABILITIES', icon: '📚' },
    { id: 'keybinds', label: 'KEYBINDS', icon: '🎹' },
    { id: 'icones', label: 'ÍCONES', icon: '🖼' },
    { id: 'overlay', label: 'OVERLAY', icon: '🎯' },
];

export default function Settings() {
    const [activeTab, setActiveTab] = useState('rotacao');
    const [abilities, setAbilities] = useState({});
    const [rotations, setRotations] = useState([]);
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [ab, rots, sets] = await Promise.all([
                    api.loadAbilities(), api.loadRotations(), api.loadSettings(),
                ]);
                if (cancelled) return;
                setAbilities(ab || {});
                setRotations(rots || []);
                setSettings(sets);
            } catch (err) {
                console.error('[Settings] Failed to load data:', err);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Listen for real-time changes from overlay/main process
    useEffect(() => {
        const cleanups = [
            api.onRotationsChanged((data) => setRotations(data || [])),
            api.onAbilitiesChanged((data) => setAbilities(data || {})),
            api.onSettingsChanged((data) => setSettings(data)),
        ];
        return () => cleanups.forEach(fn => fn && fn());
    }, []);

    const saveAbilitiesData = async (data) => {
        setAbilities(data);
        await api.saveAbilities(data);
    };

    const refreshRotations = async () => {
        try {
            const rots = await api.loadRotations();
            setRotations(rots || []);
        } catch (err) {
            console.error('[Settings] Failed to refresh rotations:', err);
        }
    };

    const saveSettingsData = async (data) => {
        setSettings(data);
        await api.saveSettings(data);
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'rotacao':
                return <TabRotacao rotations={rotations} abilities={abilities} refreshRotations={refreshRotations} />;
            case 'abilities':
                return <TabAbilities abilities={abilities} saveAbilities={saveAbilitiesData} />;
            case 'keybinds':
                return <TabKeybinds abilities={abilities} rotations={rotations} saveAbilities={saveAbilitiesData} />;
            case 'icones':
                return <TabIcones abilities={abilities} />;
            case 'overlay':
                return <TabOverlay settings={settings} saveSettings={saveSettingsData} />;
            default:
                return null;
        }
    };

    return (
        <div className="settings-container">
            {/* Header */}
            <div className="settings-header">
                <div className="settings-title">
                    <span className="settings-icon">⚙</span>
                    <span>Configurações</span>
                </div>
                <button className="settings-close" onClick={() => api.closeSettings()}>✕</button>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="tab-icon">{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="settings-content">
                {renderTab()}
            </div>
        </div>
    );
}
