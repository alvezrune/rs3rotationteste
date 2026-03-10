# RS3 Rotation Overlay

A floating Electron overlay for RuneScape 3 PvM that tracks your ability rotation in real-time.

## Features

- **Always-on-top overlay** that floats over RS3
- **Real-time key tracking** via global keyboard listener (no game interaction)
- **Visual rotation track** — current skill glowing, next skills visible ahead
- **Boss selector** with pre-loaded PVME rotations (Necromancy, Melee, Ranged, Magic)
- **Full rotation editor** — add/edit/delete rotations and bosses
- **Per-skill keybind configurator** — click to capture your exact key
- **Progress bar** and step counter
- **Transparent & draggable** — position it anywhere on screen

---

## Setup

### Requirements
- Node.js 18+ (https://nodejs.org)

### Install & Run

```bash
# 1. Enter the project folder
cd rs3-rotation-overlay

# 2. Install dependencies
npm install

# 3. Run the app
npm start
```

### Build (Windows Portable .exe)

```bash
npm run build
```
The portable `.exe` will be in `dist/`.

---

## How to Use

1. **Launch** the app — a small floating panel appears
2. **Click "Choose Boss / Rotation"** to select your fight
3. The overlay shows the **current skill** (large, glowing) and **upcoming skills** to the right
4. **Press your ability keys** in RS3 — the overlay automatically advances when you press the correct key
5. **Wrong key** = red flash (if you're pressing another rotation key by mistake)
6. When rotation completes → **green completion screen** → click Restart

---

## Configuring Your Keybinds

1. Click **⚙** (settings icon) on the overlay title bar
2. Go to **"Rotations & Keys"** tab
3. Select your rotation on the left
4. For each skill, **click the Key field** → press your actual RS3 keybind
5. Click **"💾 Save Rotation"**

---

## Supported Keys

- Numbers: `1 2 3 4 5 6 7 8 9 0`
- Letters: `q w e r t y u i o p a s d f g h j k l z x c v b n m`
- Function keys: `F1` through `F12`
- Special: `Space`, `Tab`

---

## Adding Custom Rotations

1. Settings → Rotations & Keys → click **"+ New"**
2. Set the rotation name, category, and description
3. Add skills with **"+ Add Skill"**
4. For each skill: set the name, click the key field to capture your keybind, choose type (Ability/Ultimate/Auto/Prayer) and color
5. Click **"💾 Save Rotation"**

---

## Notes

- The overlay uses **Electron's globalShortcut** — it registers your rotation keys system-wide while tracking is active
- It does **not** inject inputs, read memory, or interact with RS3 in any way
- If a key conflict occurs (e.g. key already registered by another app), that key may not be captured — try an alternative

---

## Data Storage

All your rotations and settings are saved locally:
- **Windows:** `%APPDATA%/rs3-rotation-overlay/`
- **Linux:** `~/.config/rs3-rotation-overlay/`

Files: `config.json` (settings) and `rotations.json` (your rotations)
