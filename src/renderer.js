// src/renderer.js

window.addEventListener('DOMContentLoaded', () => {
  // --- Login básico + inicialización de mapa Leaflet con rutas interactiva ---

  const loginForm = document.getElementById('login-form');
  const loginScreen = document.getElementById('login-screen');
  const mapScreen = document.getElementById('map-screen');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  const routeNameInput = document.getElementById('route-name-input');
  const saveRouteBtn = document.getElementById('btn-save-route');
  const refreshRoutesBtn = document.getElementById('btn-refresh-routes');
  const routesList = document.getElementById('routes-list');

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
  const logoutBtn = document.getElementById('btn-logout');

  const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || 'http://localhost:4799/api';
  let editingRouteId = null;

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

  function resetRouteForm() {
    if (routeNameInput) routeNameInput.value = '';
    editingRouteId = null;
    if (saveRouteBtn) saveRouteBtn.textContent = 'Guardar ruta';
  }

  async function apiRequest(path, options = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const opts = {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(url, opts);
    if (!response.ok) {
      let detail = `Error HTTP ${response.status}`;
      try {
        const raw = await response.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.message) {
              detail = parsed.message;
            } else {
              detail = raw;
            }
          } catch (_jsonError) {
            detail = raw;
          }
        }
      } catch (_readError) {
        /* ignore read errors */
      }
      throw new Error(detail);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function renderRoutes(list) {
    if (!routesList) return;
    routesList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      routesList.innerHTML = '<li class="text-muted">No hay rutas guardadas todavía.</li>';
      return;
    }

    list.forEach((route) => {
      const item = document.createElement('li');
      item.dataset.id = route.id;
      item.dataset.name = route.name || '';
      item.dataset.originLat = route.origin_lat ?? '';
      item.dataset.originLng = route.origin_lng ?? '';
      item.dataset.destLat = route.dest_lat ?? '';
      item.dataset.destLng = route.dest_lng ?? '';

      const title = document.createElement('div');
      title.textContent = route.name || `Ruta ${route.id}`;
      title.className = 'fw-semibold';

      const meta = document.createElement('div');
      meta.className = 'route-meta';
      const originText = route.origin_lat && route.origin_lng
        ? `${Number(route.origin_lat).toFixed(4)}, ${Number(route.origin_lng).toFixed(4)}`
        : 'sin origen';
      const destText = route.dest_lat && route.dest_lng
        ? `${Number(route.dest_lat).toFixed(4)}, ${Number(route.dest_lng).toFixed(4)}`
        : 'sin destino';
      meta.textContent = `Origen: ${originText} · Destino: ${destText}`;

      const btnGroup = document.createElement('div');
      btnGroup.className = 'btn-group';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline-light btn-sm';
      editBtn.type = 'button';
      editBtn.dataset.action = 'edit';
      editBtn.dataset.id = route.id;
      editBtn.textContent = 'Editar';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-outline-danger btn-sm';
      deleteBtn.type = 'button';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = route.id;
      deleteBtn.textContent = 'Eliminar';

      btnGroup.append(editBtn, deleteBtn);
      item.append(title, meta, btnGroup);
      routesList.append(item);
    });
  }

  async function loadRoutes() {
    try {
      const data = await apiRequest('/routes');
      renderRoutes(data);
    } catch (error) {
      console.error('No se pudieron cargar las rutas', error);
      if (routesList) {
        routesList.innerHTML = `<li class="text-danger">Error al cargar rutas: ${error.message}</li>`;
      }
    }
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

  if (refreshRoutesBtn) {
    refreshRoutesBtn.addEventListener('click', () => {
      loadRoutes();
    });
  }

  if (routesList) {
    routesList.addEventListener('click', (event) => {
      const target = event.target;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action || !id) return;

      const parent = target.closest('li');
      if (!parent) return;

      if (action === 'edit') {
        editingRouteId = Number(id);
        if (routeNameInput) routeNameInput.value = parent.dataset.name || '';

        const oLat = parseFloat(parent.dataset.originLat);
        const oLng = parseFloat(parent.dataset.originLng);
        const dLat = parseFloat(parent.dataset.destLat);
        const dLng = parseFloat(parent.dataset.destLng);

        if (!Number.isNaN(oLat) && !Number.isNaN(oLng)) {
          originLatLng = L.latLng(oLat, oLng);
          if (originMarker) map.removeLayer(originMarker);
          if (map) {
            originMarker = L.circleMarker(originLatLng, { radius: 7, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 0.95 }).addTo(map);
            map.panTo(originLatLng);
          }
          if (originInput) originInput.value = `${oLat.toFixed(5)}, ${oLng.toFixed(5)}`;
        }
        if (!Number.isNaN(dLat) && !Number.isNaN(dLng)) {
          destLatLng = L.latLng(dLat, dLng);
          if (destMarker) map.removeLayer(destMarker);
          if (map) {
            destMarker = L.circleMarker(destLatLng, { radius: 7, color: '#f44336', fillColor: '#f44336', fillOpacity: 0.95 }).addTo(map);
            map.panTo(destLatLng);
          }
          if (destInput) destInput.value = `${dLat.toFixed(5)}, ${dLng.toFixed(5)}`;
        }
        calcPlannedRoute();
        if (saveRouteBtn) saveRouteBtn.textContent = 'Actualizar ruta';
      } else if (action === 'delete') {
        if (confirm('¿Eliminar esta ruta definitivamente?')) {
          apiRequest(`/routes/${id}`, { method: 'DELETE' })
            .then(() => {
              if (Number(editingRouteId) === Number(id)) {
                resetRouteForm();
              }
              loadRoutes();
            })
            .catch((error) => alert(`No se pudo eliminar: ${error.message}`));
        }
      }
    });
  }

  if (saveRouteBtn) {
    saveRouteBtn.addEventListener('click', async () => {
      if (!map) initMap();
      const name = routeNameInput && routeNameInput.value.trim();
      if (!name) {
        alert('Escribe el nombre de la ruta.');
        return;
      }

      const originCandidate = originLatLng || routePoints[0] || null;
      const destCandidate = destLatLng || routePoints[routePoints.length - 1] || null;

      const payload = {
        name,
        originLat: originCandidate ? originCandidate.lat : null,
        originLng: originCandidate ? originCandidate.lng : null,
        destLat: destCandidate ? destCandidate.lat : null,
        destLng: destCandidate ? destCandidate.lng : null,
      };

      try {
        if (editingRouteId) {
          await apiRequest(`/routes/${editingRouteId}`, { method: 'PUT', body: payload });
        } else {
          await apiRequest('/routes', { method: 'POST', body: payload });
        }
        resetRouteForm();
        loadRoutes();
      } catch (error) {
        alert(`No se pudo guardar la ruta: ${error.message}`);
      }
    });
  }

  // Botón Cerrar sesión: volver al login y limpiar sesión/estado
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setCurrentUser(null);
      // Limpiar UI del mapa básica
      if (routeLine) { map && map.removeLayer(routeLine); routeLine = null; }
      routeMarkers.forEach(m => map && map.removeLayer(m));
      routeMarkers = [];
      routePoints = [];
      // Ocultar mapa y mostrar login
      showScreen('login-screen');
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
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value && emailInput.value.trim().toLowerCase();
    const password = passwordInput.value && passwordInput.value.trim();

    if (!email || !password) {
      alert('Por favor introduce correo y contraseña.');
      return;
    }

    const cfg = window.APP_CONFIG || {};
    if (cfg.betaAllowAnyLogin) {
      enterMapSession({ email, firstName: email.split('@')[0] || 'Usuario beta' });
      return;
    }

    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const user = response && response.user ? response.user : null;
      if (!user) {
        throw new Error('Respuesta inesperada del servidor');
      }
      enterMapSession(user);
    } catch (error) {
      alert(`No se pudo iniciar sesión: ${error.message}`);
    } finally {
      if (passwordInput) passwordInput.value = '';
    }
  });

  // --- Registro de usuarios (UI y lógica) ---
  const showRegisterLink = document.getElementById('show-register');
  const registerScreen = document.getElementById('register-screen');
  const registerForm = document.getElementById('register-form');
  const regName = document.getElementById('reg-name');
  const regLastName = document.getElementById('reg-lastname');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const regPasswordConfirm = document.getElementById('reg-password-confirm');
  const registerBack = document.getElementById('register-back');
  const loginCloseButton = document.getElementById('login-close');

  function showScreen(id) {
    // hide all
    [loginScreen, registerScreen, mapScreen].forEach(el => { if (el) el.style.display = 'none'; });
    // show selected
    const el = document.getElementById(id);
    if (el) el.style.display = id === 'map-screen' ? 'flex' : 'block';
    if (id === 'map-screen') document.body.classList.add('map-active');
    else document.body.classList.remove('map-active');
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

  if (loginCloseButton) {
    loginCloseButton.addEventListener('click', () => {
      window.close?.();
    });
  }

  function buildDisplayName(user) {
    if (!user) return 'Invitado';
    const first = (user.firstName || user.name || '').trim();
    const last = (user.lastName || '').trim();
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    if (user.email) return user.email.split('@')[0];
    return 'Invitado';
  }

  function setCurrentUser(user) {
    if (!user) {
      try { localStorage.removeItem('padondep_currentUser'); } catch (error) {
        console.warn('No se pudo limpiar la sesión:', error.message);
      }
      return;
    }
    const payload = {
      id: user.id ?? null,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      name: user.name ?? buildDisplayName(user),
    };
    try {
      localStorage.setItem('padondep_currentUser', JSON.stringify(payload));
    } catch (error) {
      console.warn('No se pudo persistir la sesión:', error.message);
    }
  }

  function enterMapSession(user) {
    setCurrentUser(user);
    showScreen('map-screen');
    setTimeout(() => {
      initMap();
      if (startBtn) startBtn.disabled = false;
      applyModelPreference();
      loadRoutes();
    }, 50);
  }

  function resetRegisterFormFields() {
    if (registerForm) registerForm.reset();
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = regName.value && regName.value.trim();
      const lastName = regLastName && regLastName.value ? regLastName.value.trim() : '';
      const email = regEmail.value && regEmail.value.trim().toLowerCase();
      const pass = regPassword.value && regPassword.value;
      const pass2 = regPasswordConfirm.value && regPasswordConfirm.value;

      if (!firstName || !email || !pass || !pass2) {
        alert('Por favor completa todos los campos.');
        return;
      }
      if (pass !== pass2) {
        alert('Las contraseñas no coinciden.');
        return;
      }

      const cfg = window.APP_CONFIG || {};
      if (cfg.betaAllowAnyLogin) {
        enterMapSession({ firstName, lastName, email });
        resetRegisterFormFields();
        if (regPassword) regPassword.value = '';
        if (regPasswordConfirm) regPasswordConfirm.value = '';
        return;
      }

      try {
        const response = await apiRequest('/users', {
          method: 'POST',
          body: {
            firstName,
            lastName,
            email,
            password: pass,
          },
        });
        const user = response && response.user ? response.user : null;
        if (!user) {
          throw new Error('Respuesta inesperada del servidor');
        }
        enterMapSession(user);
        resetRegisterFormFields();
      } catch (error) {
        alert(`No se pudo registrar el usuario: ${error.message}`);
      } finally {
        if (regPassword) regPassword.value = '';
        if (regPasswordConfirm) regPasswordConfirm.value = '';
      }
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
