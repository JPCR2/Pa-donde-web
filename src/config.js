// src/config.js
// Configuración local para feature flags y ajustes.
// Cambia estos valores según necesites. Esta configuración se expone como
// window.APP_CONFIG para que el renderer pueda leerla.

(function () {
  window.APP_CONFIG = {
    // Habilitar el uso de "Claude Sonnet 3.5" dentro de la app
    useClaudeSonnet35: true,
    // Nombre del modelo que la app enviará al backend cuando solicite usar Claude
    modelName: 'claude-sonnet-3.5',
    // Opcional: endpoint relativo para notificar/configurar el backend
    modelEndpoint: '/api/set-model',
    // Beta: permitir login sin registro previo
    betaAllowAnyLogin: true
  };
})();
