// main.js

// 1. Importar los módulos necesarios de Electron
const { app, BrowserWindow } = require('electron');
const path = require('path');
const startApiServer = require('./src/backend/server');
const { closePool } = require('./src/backend/db');

let apiServer;

// 2. Función para crear la ventana principal de la aplicación
const createWindow = () => {
  // Crear una nueva ventana del navegador
  const win = new BrowserWindow({
    width: 800, // Ancho de la ventana
    height: 600, // Alto de la ventana
    autoHideMenuBar: true, // Oculta la barra de menú por defecto (File, Edit, View...)
    // title: '', // Descomenta si quieres ocultar también el título de la ventana
    webPreferences: {
      
      preload: path.join(__dirname, 'src/preload.js')
    }
  });

  
  win.loadFile('src/index.html');

  
  win.setMenuBarVisibility(false);

  
};

app.whenReady().then(() => {
  try {
    apiServer = startApiServer();
  } catch (error) {
    console.error('[API] No se pudo iniciar la API local:', error);
  }

  createWindow();

  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.once('before-quit', () => {
  if (apiServer?.server) {
    apiServer.server.close(() => {
      console.log('API local detenida');
    });
  }
  closePool().catch((error) => {
    console.error('[API] Error al cerrar el pool de MySQL', error);
  });
});