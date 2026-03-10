import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    base: './',
    root: 'src',
    build: {
        outDir: '../dist-vite',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                overlay: resolve(__dirname, 'src/overlay/index.html'),
                settings: resolve(__dirname, 'src/settings/index.html'),
            },
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
});
