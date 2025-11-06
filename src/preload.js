// src/preload.js
// Archivo preload seguro y vacío. Si necesitas exponer APIs del main al renderer,
// usa contextBridge aquí. Por ahora dejamos este archivo vacío para evitar que
// 'renderer.js' se ejecute como preload y cause errores.

// Ejemplo (comentado):
// const { contextBridge } = require('electron');
// contextBridge.exposeInMainWorld('myApi', { hello: () => 'world' });
