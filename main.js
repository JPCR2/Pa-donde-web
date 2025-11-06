// main.js

// 1. Importar los módulos necesarios de Electron
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 2. Función para crear la ventana principal de la aplicación
const createWindow = () => {
  // Crear una nueva ventana del navegador
  const win = new BrowserWindow({
    width: 800, // Ancho de la ventana
    height: 600, // Alto de la ventana
    autoHideMenuBar: true, // Oculta la barra de menú por defecto (File, Edit, View...)
    // title: '', // Descomenta si quieres ocultar también el título de la ventana
    webPreferences: {
      // Usar un preload separado (vacío o con bridge) — no ejecutar 'renderer.js' como preload.
      preload: path.join(__dirname, 'src/preload.js')
    }
  });

  // Cargar el archivo index.html en la ventana
  // Le decimos que nuestro HTML está en la carpeta 'src'
  win.loadFile('src/index.html');

  // Ocultar explícitamente la barra de menú (por si algún SO no respeta autoHideMenuBar)
  win.setMenuBarVisibility(false);

  // Opcional: Abrir las herramientas de desarrollador (como en Chrome)
  // win.webContents.openDevTools();
};

// 3. Evento: Ejecutar 'createWindow' cuando la app esté lista
app.whenReady().then(() => {
  createWindow();

  // (Solo para macOS) Volver a crear la ventana si se hace clic en el ícono del dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 4. Evento: Salir de la app cuando todas las ventanas estén cerradas
// (Excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});