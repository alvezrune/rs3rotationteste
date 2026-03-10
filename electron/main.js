const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const path = require('path');
const fs = require('fs');
const KeybindManager = require('./keybind-manager');

// ============ PATHS ============
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const ICONS_DIR = path.join(app.getPath('userData'), 'abilities-icons');
const ABILITIES_PATH = path.join(DATA_DIR, 'abilities.json');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const ROTATIONS_DIR = path.join(DATA_DIR, 'rotations');

// Ensure data directories exist
[DATA_DIR, ROTATIONS_DIR, ICONS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ MIGRATION ============
function migrateData() {
    // 1. Migrate icons from legacy assets folder to userData
    const legacyIconsDir = path.join(__dirname, '..', 'assets', 'abilities-icons');
    if (fs.existsSync(legacyIconsDir)) {
        console.log('Migrating icons from', legacyIconsDir, 'to', ICONS_DIR);
        try {
            const files = fs.readdirSync(legacyIconsDir).filter(f => f.endsWith('.png') || f.endsWith('.webp'));
            files.forEach(file => {
                const src = path.join(legacyIconsDir, file);
                const dest = path.join(ICONS_DIR, file);
                if (!fs.existsSync(dest)) {
                    fs.copyFileSync(src, dest);
                }
            });
        } catch (e) {
            console.error('Icons migration failed:', e);
        }
    }

    // 2. Migrate data from legacy root data folder to userData
    const oldDataDir = path.join(__dirname, '..', 'data');
    if (fs.existsSync(oldDataDir) && oldDataDir !== DATA_DIR) {
        console.log('Migrating data from', oldDataDir, 'to', DATA_DIR);
        try {
            // Migrate settings
            const oldSettings = path.join(oldDataDir, 'settings.json');
            if (fs.existsSync(oldSettings) && !fs.existsSync(SETTINGS_PATH)) {
                fs.copyFileSync(oldSettings, SETTINGS_PATH);
            }

            // Migrate abilities
            const oldAbilities = path.join(oldDataDir, 'abilities.json');
            if (fs.existsSync(oldAbilities) && !fs.existsSync(ABILITIES_PATH)) {
                fs.copyFileSync(oldAbilities, ABILITIES_PATH);
            }

            // Migrate rotations
            const oldRotationsDir = path.join(oldDataDir, 'rotations');
            if (fs.existsSync(oldRotationsDir)) {
                const files = fs.readdirSync(oldRotationsDir).filter(f => f.endsWith('.json'));
                files.forEach(file => {
                    const src = path.join(oldRotationsDir, file);
                    const dest = path.join(ROTATIONS_DIR, file);
                    if (!fs.existsSync(dest)) {
                        fs.copyFileSync(src, dest);
                    }
                });
            }
            console.log('Data migration complete.');
        } catch (e) {
            console.error('Migration failed:', e);
        }
    }

    // 3. Fallback: If no abilities.json in userData, copy the default one from assets
    const defaultAbilities = path.join(__dirname, '..', 'assets', 'abilities.json');
    if (!fs.existsSync(ABILITIES_PATH) && fs.existsSync(defaultAbilities)) {
        try {
            fs.copyFileSync(defaultAbilities, ABILITIES_PATH);
            console.log('Default abilities copied to userData');
        } catch (e) {
            console.error('Failed to copy default abilities:', e);
        }
    }
}
migrateData();

// ============ STATE ============
let overlayWindow = null;
let settingsWindow = null;
const keybindManager = new KeybindManager();
let savePositionTimeout = null;
let saveSizeTimeout = null;

// ============ DATA HELPERS ============
function loadJSON(filePath, fallback = {}) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error(`Erro ao carregar ${filePath}:`, e);
    }
    return fallback;
}

function saveJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Erro ao salvar ${filePath}:`, e);
        return false;
    }
}

function loadSettings() {
    const defaults = {
        overlay: {
            x: 100, y: 50, width: 640, height: 115, opacity: 0.90,
            showPreviousSlot: true, showSkillNames: true, iconSize: 'medium',
            pulseSpeed: 'normal', alertDuration: 4000, flashOnError: false
        },
        lastRotation: null,
        sounds: { onError: true, onError_volume: 0.5, onPhaseComplete: true }
    };
    const saved = loadJSON(SETTINGS_PATH, defaults);
    return { ...defaults, ...saved, overlay: { ...defaults.overlay, ...saved.overlay } };
}

function saveSettings(data) { return saveJSON(SETTINGS_PATH, data); }

function loadAbilities() {
    return loadJSON(ABILITIES_PATH, {});
}

function saveAbilities(data) {
    return saveJSON(ABILITIES_PATH, data);
}

function loadRotations() {
    const rotations = [];
    try {
        if (fs.existsSync(ROTATIONS_DIR)) {
            const files = fs.readdirSync(ROTATIONS_DIR).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(ROTATIONS_DIR, file), 'utf8'));
                    rotations.push(data);
                } catch (e) {
                    console.error(`Erro ao carregar rotação ${file}:`, e);
                }
            }
        }
    } catch (e) {
        console.error('Erro ao listar rotações:', e);
    }
    // Also load legacy rotations.json from assets
    const legacyPath = path.join(__dirname, '..', 'assets', 'rotations.json');
    if (fs.existsSync(legacyPath)) {
        try {
            const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
            if (legacy.bosses && Array.isArray(legacy.bosses)) {
                for (const boss of legacy.bosses) {
                    // Only add if not already in rotations
                    if (!rotations.find(r => r.id === boss.id)) {
                        // Convert legacy format to new format
                        const converted = {
                            id: boss.id || boss.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                            name: boss.name,
                            style: boss.category || 'util',
                            bossGroup: boss.bossGroup || '',
                            phases: [{
                                id: 'default',
                                name: 'Rotação',
                                steps: (boss.rotation || []).map(skill => ({
                                    skills: [skill],
                                    note: '',
                                    passive: false,
                                })),
                            }],
                        };
                        rotations.push(converted);
                    }
                }
            }
        } catch (e) {
            console.error('Erro ao carregar rotações legacy:', e);
        }
    }
    return rotations;
}

function saveRotation(name, data) {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const filePath = path.join(ROTATIONS_DIR, `${safeName}.json`);
    return saveJSON(filePath, { ...data, id: data.id || safeName });
}

function deleteRotation(identifier) {
    // First try by slug name
    const safeName = identifier.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const fileByName = path.join(ROTATIONS_DIR, `${safeName}.json`);
    try {
        if (fs.existsSync(fileByName)) {
            fs.unlinkSync(fileByName);
            return true;
        }
        // If not found by slug, search by id inside JSON files
        const files = fs.readdirSync(ROTATIONS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const filePath = path.join(ROTATIONS_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (data.id === identifier) {
                    fs.unlinkSync(filePath);
                    return true;
                }
            } catch (e) { /* skip invalid files */ }
        }
    } catch (e) {
        console.error(`Erro ao deletar rotação:`, e);
    }
    return false;
}

// ============ WINDOW CREATION ============
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

function getRendererURL(page) {
    if (isDev) {
        return `http://localhost:5173/${page}/index.html`;
    }
    return `file://${path.join(__dirname, '..', 'dist-vite', page, 'index.html')}`;
}

function createOverlayWindow() {
    const settings = loadSettings();
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: settings.overlay.width || 640,
        height: settings.overlay.height || 115,
        x: settings.overlay.x ?? Math.floor(screenW / 2 - 320),
        y: settings.overlay.y ?? 50,
        show: false,
        backgroundColor: '#00000000',
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
            backgroundThrottling: false,
        }
    });

    overlayWindow.once('ready-to-show', () => {
        overlayWindow.show();
    });

    overlayWindow.loadURL(getRendererURL('overlay'));
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true);

    if (settings.overlay.opacity != null) {
        overlayWindow.setOpacity(settings.overlay.opacity);
    }

    // Save position with debounce
    overlayWindow.on('moved', () => {
        clearTimeout(savePositionTimeout);
        savePositionTimeout = setTimeout(() => {
            if (!overlayWindow || overlayWindow.isDestroyed()) return;
            const [x, y] = overlayWindow.getPosition();
            const s = loadSettings();
            s.overlay.x = x;
            s.overlay.y = y;
            saveSettings(s);
        }, 500);
    });

    // Save size with debounce
    overlayWindow.on('resize', () => {
        clearTimeout(saveSizeTimeout);
        saveSizeTimeout = setTimeout(() => {
            if (!overlayWindow || overlayWindow.isDestroyed()) return;
            const [width, height] = overlayWindow.getSize();
            const s = loadSettings();
            s.overlay.width = width;
            s.overlay.height = height;
            saveSettings(s);
        }, 500);
    });

    overlayWindow.on('closed', () => { overlayWindow = null; });

    if (isDev) {
        overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

function createSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 880,
        height: 620,
        frame: false,
        transparent: false,
        backgroundColor: '#08090f',
        alwaysOnTop: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
        }
    });

    settingsWindow.loadURL(getRendererURL('settings'));

    settingsWindow.on('closed', () => { settingsWindow = null; });

    if (isDev) {
        settingsWindow.webContents.openDevTools({ mode: 'detach' });
    }
}

// ============ CRASH HANDLERS ============
process.on('uncaughtException', (err) => {
    console.error('[CRASH] Uncaught Exception:', err);
    // NÃO chamar app.quit() aqui — apenas logar
});
process.on('unhandledRejection', (reason) => {
    console.error('[CRASH] Unhandled Rejection:', reason);
});

// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
    createOverlayWindow();
    setupUiohook();
});

app.on('will-quit', () => {
    try {
        keybindManager.unregisterAll();
    } catch (e) {
        console.error('Error unregistering keys on quit:', e);
    }
});

app.on('window-all-closed', () => {
    try { uIOhook.stop(); } catch (e) { }
    app.quit();
});

// ============ UIOHOOK SETUP ============
const keycodeToChar = {};

function setupUiohook() {
    // Mapeamento completo: letras, números, F-keys, especiais
    const manualMap = {
        [UiohookKey.A]: 'a', [UiohookKey.B]: 'b', [UiohookKey.C]: 'c',
        [UiohookKey.D]: 'd', [UiohookKey.E]: 'e', [UiohookKey.F]: 'f',
        [UiohookKey.G]: 'g', [UiohookKey.H]: 'h', [UiohookKey.I]: 'i',
        [UiohookKey.J]: 'j', [UiohookKey.K]: 'k', [UiohookKey.L]: 'l',
        [UiohookKey.M]: 'm', [UiohookKey.N]: 'n', [UiohookKey.O]: 'o',
        [UiohookKey.P]: 'p', [UiohookKey.Q]: 'q', [UiohookKey.R]: 'r',
        [UiohookKey.S]: 's', [UiohookKey.T]: 't', [UiohookKey.U]: 'u',
        [UiohookKey.V]: 'v', [UiohookKey.W]: 'w', [UiohookKey.X]: 'x',
        [UiohookKey.Y]: 'y', [UiohookKey.Z]: 'z',
        [UiohookKey[0]]: '0', [UiohookKey[1]]: '1', [UiohookKey[2]]: '2',
        [UiohookKey[3]]: '3', [UiohookKey[4]]: '4', [UiohookKey[5]]: '5',
        [UiohookKey[6]]: '6', [UiohookKey[7]]: '7', [UiohookKey[8]]: '8',
        [UiohookKey[9]]: '9',
        [UiohookKey.F1]: 'f1', [UiohookKey.F2]: 'f2', [UiohookKey.F3]: 'f3',
        [UiohookKey.F4]: 'f4', [UiohookKey.F5]: 'f5', [UiohookKey.F6]: 'f6',
        [UiohookKey.F7]: 'f7', [UiohookKey.F8]: 'f8', [UiohookKey.F9]: 'f9',
        [UiohookKey.F10]: 'f10', [UiohookKey.F11]: 'f11', [UiohookKey.F12]: 'f12',
        [UiohookKey.Space]: 'space',
        [UiohookKey.Tab]: 'tab',
        [UiohookKey.Escape]: 'escape',
        [UiohookKey.Backspace]: 'backspace',
        [UiohookKey.Enter]: 'enter',
        [UiohookKey.Numpad0]: 'num0', [UiohookKey.Numpad1]: 'num1',
        [UiohookKey.Numpad2]: 'num2', [UiohookKey.Numpad3]: 'num3',
        [UiohookKey.Numpad4]: 'num4', [UiohookKey.Numpad5]: 'num5',
        [UiohookKey.Numpad6]: 'num6', [UiohookKey.Numpad7]: 'num7',
        [UiohookKey.Numpad8]: 'num8', [UiohookKey.Numpad9]: 'num9',
    };
    Object.assign(keycodeToChar, manualMap);

    try {
        uIOhook.on('keydown', (e) => {
            try {
                if (!keybindManager.isTracking) return;
                const baseKey = keycodeToChar[e.keycode];
                if (!baseKey) return;

                const res = [];
                if (e.ctrlKey) res.push('ctrl');
                if (e.shiftKey) res.push('shift');
                if (e.altKey) res.push('alt');
                if (e.metaKey) res.push('meta');
                res.push(baseKey);
                const comboStr = res.join('+');

                if (keybindManager.isRegistered(comboStr)) {
                    if (overlayWindow && !overlayWindow.isDestroyed()) {
                        overlayWindow.webContents.send('key-pressed', { key: comboStr });
                    }
                }
            } catch (err) {
                console.error('[uIOhook] keydown handler error:', err);
            }
        });

        uIOhook.start();
    } catch (err) {
        console.error('[CRASH] Error starting uIOhook:', err);
    }
}

// ============ IPC HANDLERS ============

// -- Janelas --
ipcMain.removeAllListeners('close-overlay');
ipcMain.on('close-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
    app.quit();
});
ipcMain.removeAllListeners('minimize-overlay');
ipcMain.on('minimize-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.minimize();
});
ipcMain.removeAllListeners('open-settings');
ipcMain.on('open-settings', () => createSettingsWindow());
ipcMain.removeAllListeners('close-settings');
ipcMain.on('close-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
});
ipcMain.removeAllListeners('set-opacity');
ipcMain.on('set-opacity', (_, val) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(val);
    }
});
ipcMain.removeAllListeners('set-window-size');
let setWindowSizeTimeout = null;
ipcMain.on('set-window-size', (event, width, height) => {
    clearTimeout(setWindowSizeTimeout);
    setWindowSizeTimeout = setTimeout(() => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            win.setSize(Math.round(width), Math.round(height));
        }
    }, 30);
});
ipcMain.removeAllListeners('set-ignore-mouse-events');
ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
        win.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

// -- Dados --
ipcMain.handle('load-abilities', () => loadAbilities());
ipcMain.handle('save-abilities', (_, data) => {
    saveAbilities(data);
    // Broadcast abilities change to overlay in real-time
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('abilities-changed', data);
    }
    return true;
});
ipcMain.handle('load-rotations', () => loadRotations());
ipcMain.handle('save-rotation', (_, name, data) => {
    saveRotation(name, data);
    // Broadcast rotations change to all windows in real-time
    const rots = loadRotations();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('rotations-changed', rots);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('rotations-changed', rots);
    }
    return true;
});
ipcMain.handle('delete-rotation', (_, name) => {
    deleteRotation(name);
    // Broadcast rotations change to all windows in real-time
    const rots = loadRotations();
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('rotations-changed', rots);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('rotations-changed', rots);
    }
    return true;
});
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, data) => {
    saveSettings(data);
    // Notify overlay of settings changes
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('settings-changed', data);
        if (data.overlay) {
            if (data.overlay.opacity != null) {
                overlayWindow.setOpacity(Number(data.overlay.opacity));
            }
            if (data.overlay.width && data.overlay.height) {
                overlayWindow.setSize(Math.round(data.overlay.width), Math.round(data.overlay.height));
            }
        }
    }
    return true;
});

// -- Ícones --
ipcMain.handle('choose-icon', async (_, abilityId) => {
    const win = settingsWindow || overlayWindow;
    if (!win) return null;

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Selecione a imagem do ícone',
        filters: [{ name: 'Imagens', extensions: ['png', 'webp', 'jpg'] }],
        properties: ['openFile'],
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const src = filePaths[0];
        const dest = path.join(ICONS_DIR, `${abilityId}.png`);
        fs.copyFileSync(src, dest);
        return true;
    } catch (err) {
        console.error('Erro ao copiar ícone:', err);
        return null;
    }
});

ipcMain.handle('remove-icon', (_, abilityId) => {
    const iconPath = path.join(ICONS_DIR, `${abilityId}.png`);
    try {
        if (fs.existsSync(iconPath)) {
            fs.unlinkSync(iconPath);
            return true;
        }
    } catch (e) {
        console.error('Erro ao remover ícone:', e);
    }
    return false;
});

ipcMain.removeAllListeners('open-icons-folder');
ipcMain.on('open-icons-folder', () => {
    shell.openPath(ICONS_DIR);
});

ipcMain.handle('get-icon-path', (_, abilityId) => {
    if (!abilityId) return null;
    const iconPath = path.join(ICONS_DIR, `${abilityId}.png`);
    if (fs.existsSync(iconPath)) {
        return `file:///${iconPath.replace(/\\/g, '/')}`;
    }
    return null;
});

ipcMain.handle('get-all-icon-status', () => {
    const abilities = loadAbilities();
    const result = { withIcon: [], withoutIcon: [], total: 0, iconDir: ICONS_DIR };
    for (const [id, ab] of Object.entries(abilities)) {
        const iconPath = path.join(ICONS_DIR, `${id}.png`);
        const hasIcon = fs.existsSync(iconPath);
        if (hasIcon) {
            result.withIcon.push(id);
        } else {
            result.withoutIcon.push(id);
        }
        result.total++;
    }
    return result;
});

// -- Keybinds --
ipcMain.removeAllListeners('register-rotation-keys');
let registerKeysTimeout = null;
ipcMain.on('register-rotation-keys', (_, keyMap) => {
    clearTimeout(registerKeysTimeout);
    registerKeysTimeout = setTimeout(() => {
        try {
            keybindManager.unregisterAll();
            keybindManager.registerRotationKeys(keyMap);
        } catch (e) {
            console.error('Error registering rotation keys:', e);
        }
    }, 50); // debounce 50ms
});

ipcMain.removeAllListeners('unregister-all-keys');
ipcMain.on('unregister-all-keys', () => {
    try {
        keybindManager.unregisterAll();
    } catch (e) {
        console.error('Error unregistering all keys:', e);
    }
});

ipcMain.handle('register-keybind', (_, combo, abilityId) => {
    keybindManager.updateAbility(abilityId, keybindManager.parseCombo(combo));
    return true;
});

ipcMain.handle('unregister-keybind', (_, combo) => {
    // Not really needed since we rebuild on rotation load
    return true;
});

ipcMain.handle('check-conflict', (_, combo, excludeId) => {
    return keybindManager.getConflicts(keybindManager.parseCombo(combo), excludeId);
});

// -- PVME Fetch (mantido do original) --
const https = require('https');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'RS3-Rotation-Overlay-App' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(JSON.parse(data));
                else reject(new Error(`Status Code: ${res.statusCode}`));
            });
        }).on('error', reject);
    });
}

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'RS3-Rotation-Overlay-App' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(data);
                else reject(new Error(`Status Code: ${res.statusCode}`));
            });
        }).on('error', reject);
    });
}

function capitalizeFormat(str) {
    return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

ipcMain.handle('fetch-pvme-github', async () => {
    try {
        const API_BASE = 'https://api.github.com/repos/pvme/pvme-guides/git/trees/master?recursive=1';
        const RAW_BASE = 'https://raw.githubusercontent.com/pvme/pvme-guides/master/';

        const treeData = await fetchJson(API_BASE);
        const txtFiles = treeData.tree.filter(item =>
            item.type === 'blob' &&
            item.path.startsWith('rs3-full-boss-guides/') &&
            item.path.endsWith('.txt') &&
            !item.path.includes('index.txt') &&
            !item.path.includes('README.txt')
        );

        const bossesFound = [];
        for (const item of txtFiles) {
            try {
                const text = await fetchText(RAW_BASE + item.path);
                const pathParts = item.path.split('/');
                const isSubDir = pathParts.length > 2;
                const groupRaw = isSubDir ? pathParts[1] : pathParts[1].replace('.txt', '');
                const bossGroup = capitalizeFormat(groupRaw);

                let bossName = bossGroup;
                if (isSubDir) {
                    bossName += ' - ' + capitalizeFormat(pathParts[pathParts.length - 1].replace('.txt', ''));
                }

                let category = isSubDir ? bossGroup : capitalizeFormat(item.path.split('/')[1].replace('.txt', ''));
                const lowerName = item.path.toLowerCase();
                if (lowerName.includes('hybrid')) category = 'Custom';
                else if (lowerName.includes('magic') || lowerName.includes('mage')) category = 'Magic';
                else if (lowerName.includes('melee')) category = 'Melee';
                else if (lowerName.includes('ranged') || lowerName.includes('range')) category = 'Ranged';
                else if (lowerName.includes('necro')) category = 'Necromancy';

                const lines = text.split('\n');
                let inRotationSection = false;
                const rotationTextChunks = [];

                for (const line of lines) {
                    const lowerLine = line.toLowerCase();
                    if (lowerLine.includes('## __rotation__') ||
                        lowerLine.includes('### inside instance') ||
                        lowerLine.includes('### phase 1') ||
                        lowerLine.includes('### p1')) {
                        inRotationSection = true;
                    }
                    if (lowerLine.includes('## __example kill__') || lowerLine.includes('__table of contents__')) break;
                    if (inRotationSection) rotationTextChunks.push(line);
                }

                const combinedText = rotationTextChunks.join('\n').trim();
                if (combinedText.length > 20) {
                    bossesFound.push({
                        id: item.path.replace(/\//g, '_').replace('.txt', '').replace(/-/g, '_'),
                        bossGroup, name: bossName, category, rawText: combinedText,
                    });
                }
            } catch (err) {
                console.error('Erro ao parsear:', item.path);
            }
        }
        return bossesFound;
    } catch (err) {
        console.error('Erro ao buscar PVME GitHub:', err);
        throw err;
    }
});
