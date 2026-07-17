import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const versionPath = [path.resolve(__dirname, 'VERSION'), path.resolve(__dirname, '../../VERSION')].find(fs.existsSync);
const version = process.env.DEQUEL_VERSION || (versionPath ? fs.readFileSync(versionPath, 'utf-8').trim() : '0.0.0');

export default defineConfig({
  plugins: [react()],
  define: {
    __DEQUEL_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
