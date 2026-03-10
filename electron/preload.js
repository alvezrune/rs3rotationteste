const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Janelas
    closeOverlay: () => ipcRenderer.send('close-overlay'),
    minimizeOverlay: () => ipcRenderer.send('minimize-overlay'),
    openSettings: () => ipcRenderer.send('open-settings'),
    closeSettings: () => ipcRenderer.send('close-settings'),
    setOpacity: (val) => ipcRenderer.send('set-opacity', val),
    setWindowSize: (w, h) => ipcRenderer.send('set-window-size', w, h),

    // Dados
    loadAbilities: () => ipcRenderer.invoke('load-abilities'),
    saveAbilities: (data) => ipcRenderer.invoke('save-abilities', data),
    loadRotations: () => ipcRenderer.invoke('load-rotations'),
    saveRotation: (name, data) => ipcRenderer.invoke('save-rotation', name, data),
    deleteRotation: (name) => ipcRenderer.invoke('delete-rotation', name),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

    // Ícones
    chooseIcon: (abilityId) => ipcRenderer.invoke('choose-icon', abilityId),
    removeIcon: (abilityId) => ipcRenderer.invoke('remove-icon', abilityId),
    openIconsFolder: () => ipcRenderer.send('open-icons-folder'),
    getIconPath: (abilityId) => ipcRenderer.invoke('get-icon-path', abilityId),
    getAllIconStatus: () => ipcRenderer.invoke('get-all-icon-status'),

    // Keybinds
    registerRotationKeys: (keyMap) => ipcRenderer.send('register-rotation-keys', keyMap),
    unregisterAllKeys: () => ipcRenderer.send('unregister-all-keys'),
    registerKeybind: (combo, abilityId) => ipcRenderer.invoke('register-keybind', combo, abilityId),
    unregisterKeybind: (combo) => ipcRenderer.invoke('unregister-keybind', combo),
    checkConflict: (combo, excludeId) => ipcRenderer.invoke('check-conflict', combo, excludeId),

    // PVME
    fetchPVME: () => ipcRenderer.invoke('fetch-pvme-github'),

    // Eventos → React (com cleanup)
    onKeyPressed: (fn) => {
        const handler = (_, data) => fn(data);
        ipcRenderer.on('key-pressed', handler);
        return () => ipcRenderer.removeListener('key-pressed', handler);
    },
    onSettingsChanged: (fn) => {
        const handler = (_, data) => fn(data);
        ipcRenderer.on('settings-changed', handler);
        return () => ipcRenderer.removeListener('settings-changed', handler);
    },
    onAbilitiesChanged: (fn) => {
        const handler = (_, data) => fn(data);
        ipcRenderer.on('abilities-changed', handler);
        return () => ipcRenderer.removeListener('abilities-changed', handler);
    },
    onRotationsChanged: (fn) => {
        const handler = (_, data) => fn(data);
        ipcRenderer.on('rotations-changed', handler);
        return () => ipcRenderer.removeListener('rotations-changed', handler);
    },
});
