// src/renderer.js

window.addEventListener('DOMContentLoaded', () => {
  // --- Login básico + inicialización de mapa Leaflet con rutas interactiva ---

  const loginForm = document.getElementById('login-form');
  const loginScreen = document.getElementById('login-screen');
  const mapScreen = document.getElementById('map-screen');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  // Map state
  let mapInitialized = false;
  let map = null;

  // Route drawing state
  let drawing = false;
  let routePoints = [];
  let routeMarkers = [];
  let routeLine = null;

  // Planificador simple origen/destino
  const originInput = document.getElementById('origin-input');
  const destInput = document.getElementById('dest-input');
  const selectOriginBtn = document.getElementById('btn-select-origin');
  const selectDestBtn = document.getElementById('btn-select-dest');
  const calcRouteBtn = document.getElementById('btn-calc-route');
  let selectingOrigin = false;
  let selectingDest = false;
  let originLatLng = null;
  let destLatLng = null;
  let originMarker = null;
  let destMarker = null;
  let planLine = null;

  // Controles del DOM para rutas y UI
  const startBtn = document.getElementById('start-route');
  const finishBtn = document.getElementById('finish-route');
  const clearBtn = document.getElementById('clear-route');
  const locateBtn = document.getElementById('locate-btn');
  const backLoginBtn = document.getElementById('btn-back-login');

  function initMap() {
    if (mapInitialized) return;
    mapInitialized = true;

  // Coordenadas por defecto: Playa del Carmen, MX
  const defaultLatLng = [20.629, -87.073];

    map = L.map('map').setView(defaultLatLng, 13);

    // Capa base estilo oscuro (similar a Moovit)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

  // Marcador inicial
  L.marker(defaultLatLng).addTo(map).bindPopup('Playa del Carmen').openPopup();

    // Click en mapa: seleccionar origen/destino o añadir puntos si está el modo dibujo
    map.on('click', (e) => {
      // Selección de origen/destino
      if (selectingOrigin) {
        originLatLng = e.latlng;
        if (originMarker) map.removeLayer(originMarker);
        originMarker = L.circleMarker(originLatLng, { radius: 7, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 0.95 }).addTo(map);
        if (originInput) originInput.value = `${originLatLng.lat.toFixed(5)}, ${originLatLng.lng.toFixed(5)}`;
        selectingOrigin = false;
        maybeEnableCalc();
        return;
      }
      if (selectingDest) {
        destLatLng = e.latlng;
        if (destMarker) map.removeLayer(destMarker);
        destMarker = L.circleMarker(destLatLng, { radius: 7, color: '#f44336', fillColor: '#f44336', fillOpacity: 0.95 }).addTo(map);
        if (destInput) destInput.value = `${destLatLng.lat.toFixed(5)}, ${destLatLng.lng.toFixed(5)}`;
        selectingDest = false;
        maybeEnableCalc();
        return;
      }

      // Dibujo libre (modo anterior)
      if (!drawing) return;
      addRoutePoint(e.latlng);
    });
  }

  function maybeEnableCalc() {
    if (calcRouteBtn) calcRouteBtn.disabled = !(originLatLng && destLatLng);
  }

  function calcPlannedRoute() {
    if (!originLatLng || !destLatLng) return;
    if (planLine) { map.removeLayer(planLine); planLine = null; }
    planLine = L.polyline([originLatLng, destLatLng], { color: '#ff6d00', weight: 5, dashArray: '6,6' }).addTo(map);
    map.fitBounds(planLine.getBounds(), { padding: [30, 30] });

    const infoEl = document.getElementById('route-info');
    if (infoEl) {
      const dist = L.latLng(originLatLng).distanceTo(L.latLng(destLatLng));
      const txt = dist < 1000 ? `${Math.round(dist)} m` : `${(dist/1000).toFixed(2)} km`;
      infoEl.textContent = `Distancia: ${txt}`;
    }
  }


  function addRoutePoint(latlng) {
    routePoints.push(latlng);

    // marcador pequeño
  const m = L.circleMarker(latlng, { radius: 6, color: '#ff6d00', fillColor: '#ff6d00', fillOpacity: 0.95 }).addTo(map);
    routeMarkers.push(m);

  if (routeLine) routeLine.setLatLngs(routePoints);
  else routeLine = L.polyline(routePoints, { color: '#ff6d00', weight: 5 }).addTo(map);

    updateDistanceInfo();
  }

  function clearRoute() {
    routePoints = [];
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
    if (routeLine) {
      map.removeLayer(routeLine);
      routeLine = null;
    }
    updateDistanceInfo();
    // Reset buttons
    startBtn.disabled = false;
    finishBtn.disabled = true;
    clearBtn.disabled = true;
    drawing = false;
  }

  function updateDistanceInfo() {
    const infoEl = document.getElementById('route-info');
    if (!infoEl) return;

    if (routePoints.length < 2) {
      infoEl.textContent = 'Distancia: 0 m';
      return;
    }

    let total = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const a = L.latLng(routePoints[i - 1]);
      const b = L.latLng(routePoints[i]);
      total += a.distanceTo(b);
    }

    let display = '';
    if (total < 1000) display = `${Math.round(total)} m`;
    else display = `${(total / 1000).toFixed(2)} km`;

    infoEl.textContent = `Distancia: ${display}`;
  }

  // Botones de control de ruta
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (!map) initMap();
      drawing = true;
      startBtn.disabled = true;
      finishBtn.disabled = false;
      clearBtn.disabled = false;
    });
  }

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      drawing = false;
      startBtn.disabled = false;
      finishBtn.disabled = true;
      // If no points, disable clear
      clearBtn.disabled = routePoints.length === 0;
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearRoute();
    });
  }

  // Botón Regresar: volver al login y limpiar sesión/estado
  if (backLoginBtn) {
    backLoginBtn.addEventListener('click', () => {
      try { localStorage.removeItem('padondep_currentUser'); } catch {}
      // Limpiar UI del mapa básica
      if (routeLine) { map && map.removeLayer(routeLine); routeLine = null; }
      routeMarkers.forEach(m => map && map.removeLayer(m));
      routeMarkers = [];
      routePoints = [];
      // Ocultar mapa y mostrar login
      mapScreen.style.display = 'none';
      loginScreen.style.display = 'block';
    });
  }

  // Selección de origen/destino y cálculo
  if (selectOriginBtn) {
    selectOriginBtn.addEventListener('click', () => {
      if (!map) initMap();
      selectingOrigin = true;
      selectingDest = false;
    });
  }
  if (selectDestBtn) {
    selectDestBtn.addEventListener('click', () => {
      if (!map) initMap();
      selectingDest = true;
      selectingOrigin = false;
    });
  }
  if (calcRouteBtn) {
    calcRouteBtn.addEventListener('click', () => {
      if (!map) initMap();
      calcPlannedRoute();
    });
  }

  // Botón de localizar (geolocalización sencilla)
  if (locateBtn) {
    locateBtn.addEventListener('click', () => {
      if (!map) initMap();
      if (!navigator.geolocation) {
        alert('Geolocalización no soportada.');
        return;
      }
      locateBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          map.flyTo(latlng, 15, { duration: 0.75 });
          L.circleMarker(latlng, { radius: 7, color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.9 }).addTo(map).bindPopup('Mi ubicación');
          setTimeout(() => (locateBtn.disabled = false), 500);
        },
        (err) => {
          console.warn('Geolocalización falló:', err.message);
          alert('No se pudo obtener tu ubicación.');
          locateBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  // Login form handling
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const email = emailInput.value && emailInput.value.trim();
    const password = passwordInput.value && passwordInput.value.trim();

    if (!email || !password) {
      alert('Por favor introduce correo y contraseña.');
      return;
    }

    const cfg = window.APP_CONFIG || {};
    let allow = false;
    if (cfg.betaAllowAnyLogin) {
      allow = true; // beta: permitir cualquier correo/contraseña
    } else {
      // Validar contra usuarios registrados (localStorage)
      const users = JSON.parse(localStorage.getItem('padondep_users') || '[]');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (user) {
        // Guardar sesión simple
        localStorage.setItem('padondep_currentUser', JSON.stringify({ name: user.name, email: user.email }));
        allow = true;
      }
    }
    if (!allow) {
      alert('Credenciales inválidas. Si no tienes cuenta, regístrate.');
      return;
    }

    loginScreen.style.display = 'none';
    mapScreen.style.display = 'block';

    setTimeout(() => {
      initMap();
      // enable start button when map is ready
      if (startBtn) startBtn.disabled = false;
      // Aplicar feature-flag: notificar al backend (si existe) la preferencia de modelo
      applyModelPreference();
    }, 50);
  });

  // --- Registro de usuarios (UI y lógica) ---
  const showRegisterLink = document.getElementById('show-register');
  const registerScreen = document.getElementById('register-screen');
  const registerForm = document.getElementById('register-form');
  const regName = document.getElementById('reg-name');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const regPasswordConfirm = document.getElementById('reg-password-confirm');
  const registerBack = document.getElementById('register-back');

  function showScreen(id) {
    // hide all
    [loginScreen, registerScreen, mapScreen].forEach(el => { if (el) el.style.display = 'none'; });
    // show selected
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }

  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen('register-screen');
    });
  }

  if (registerBack) {
    registerBack.addEventListener('click', () => {
      showScreen('login-screen');
    });
  }

  function getUsers() {
    return JSON.parse(localStorage.getItem('padondep_users') || '[]');
  }

  function saveUsers(users) {
    localStorage.setItem('padondep_users', JSON.stringify(users));
  }

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = regName.value && regName.value.trim();
      const email = regEmail.value && regEmail.value.trim().toLowerCase();
      const pass = regPassword.value && regPassword.value;
      const pass2 = regPasswordConfirm.value && regPasswordConfirm.value;

      if (!name || !email || !pass || !pass2) {
        alert('Por favor completa todos los campos.');
        return;
      }
      if (pass !== pass2) {
        alert('Las contraseñas no coinciden.');
        return;
      }

      const users = getUsers();
      if (users.find(u => u.email.toLowerCase() === email)) {
        alert('Ya existe una cuenta con ese correo.');
        return;
      }

      // Crear usuario (en localStorage para demo)
      users.push({ name, email, password: pass });
      saveUsers(users);

      // Auto-login tras registro
      localStorage.setItem('padondep_currentUser', JSON.stringify({ name, email }));
      showScreen('map-screen');
      setTimeout(() => {
        initMap();
        if (startBtn) startBtn.disabled = false;
        applyModelPreference();
      }, 50);
    });
  }

  // --- Feature flag wiring: leer window.APP_CONFIG y notificar al backend ---
  function applyModelPreference() {
    const cfg = window.APP_CONFIG || null;
    if (!cfg) {
      console.log('No APP_CONFIG encontrado. Usando valores por defecto.');
      return;
    }

    console.log('APP_CONFIG:', cfg);

    // Si se especificó un endpoint, intentamos notificar al backend.
    if (cfg.modelEndpoint) {
      // Hacemos un POST con la preferencia. Si no existe backend no romperá la app,
      // el catch simplemente lo registrará en consola.
      fetch(cfg.modelEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.modelName, enabled: !!cfg.useClaudeSonnet35 })
      })
        .then((res) => {
          if (!res.ok) throw new Error('Respuesta no OK');
          return res.json().catch(() => ({}));
        })
        .then((data) => console.log('Backend acknowledged model preference:', data))
        .catch((err) => console.warn('No se pudo notificar al backend sobre la preferencia del modelo:', err.message));
    }
  }

});
