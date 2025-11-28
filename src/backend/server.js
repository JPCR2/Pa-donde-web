const express = require('express');
const bcrypt = require('bcryptjs');
const { URLSearchParams } = require('url');
const config = require('./config');
const { Usuario, Route } = require('./sequelize');

const fetchImpl = (() => {
  if (typeof fetch === 'function') {
    return fetch.bind(global);
  }
  try {
    return require('node-fetch');
  } catch (error) {
    throw new Error('No se encontró un fetch compatible. Actualiza a Node 18+ o instala node-fetch.');
  }
})();

const DEFAULT_OSRM_ERROR = 'No se pudo obtener la ruta. Intenta de nuevo más tarde.';
const BCRYPT_ROUNDS = 10;

let appInstance;

function createServer() {
  if (appInstance) {
    return appInstance;
  }

  const app = express();
  app.use(express.json());

  // Permite peticiones desde el renderer (mismo origen en Electron)
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const parseLatLng = (value) => {
    if (!value || typeof value !== 'string') return null;
    const [latRaw, lngRaw] = value.split(',').map((part) => part.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  };

  app.get('/api/osrm-route', async (req, res) => {
    const origin = parseLatLng(req.query.origin);
    const dest = parseLatLng(req.query.dest);
    const profile = (req.query.profile || config.osrm.profile || 'driving').trim();

    if (!origin || !dest) {
      return res.status(400).json({ message: 'Parámetros inválidos. Usa origin=lat,lng y dest=lat,lng.' });
    }

    const timeoutMs = Math.max(Number(config.osrm.requestTimeoutMs || 0), 1000);
    const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
    const searchParams = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'false',
      alternatives: 'false',
    });
    let controller;
    if (typeof AbortController === 'function') {
      controller = new AbortController();
    }
    const requestUrl = `${config.osrm.baseUrl}/route/v1/${profile}/${coords}?${searchParams.toString()}`;

    let timeoutId;
    try {
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      }

      const response = await fetchImpl(requestUrl, {
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const detail = await response.text().catch(() => null);
        return res.status(502).json({ message: DEFAULT_OSRM_ERROR, detail });
      }

      const payload = await response.json();
      if (!payload || payload.code !== 'Ok' || !Array.isArray(payload.routes) || payload.routes.length === 0) {
        return res.status(502).json({ message: DEFAULT_OSRM_ERROR });
      }

      const primaryRoute = payload.routes[0];
      const waypointData = Array.isArray(payload.waypoints) ? payload.waypoints : [];
      res.json({
        distance: primaryRoute.distance,
        duration: primaryRoute.duration,
        geometry: primaryRoute.geometry,
        waypoints: waypointData.map((wp) => ({
          name: wp.name || null,
          latitude: Array.isArray(wp.location) ? wp.location[1] : null,
          longitude: Array.isArray(wp.location) ? wp.location[0] : null,
        })),
        raw: {
          bbox: primaryRoute?.bounds ?? null,
          legs: primaryRoute?.legs?.length ?? 0,
        },
      });
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const statusCode = error.name === 'AbortError' ? 504 : 500;
      console.error('[OSRM] Error solicitando ruta:', error.message);
      res.status(statusCode).json({ message: DEFAULT_OSRM_ERROR });
    }
  });

  const splitName = (fullName) => {
    if (!fullName) return { firstName: '', lastName: '' };
    const chunks = fullName.trim().split(/\s+/);
    if (chunks.length === 0) return { firstName: '', lastName: '' };
    const firstName = chunks.shift();
    const lastName = chunks.join(' ');
    return { firstName: firstName || '', lastName: lastName || '' };
  };

  const mapUser = (entity) => {
    if (!entity) return null;
    const row = typeof entity.get === 'function' ? entity.get({ plain: true }) : entity;
    const fullName = (row.nombre ?? row.name ?? '').trim();
    const { firstName, lastName } = splitName(fullName);
    return {
      id: row.id_usuario ?? row.id ?? null,
      firstName: firstName || fullName,
      lastName,
      name: fullName || `${firstName} ${lastName}`.trim(),
      email: row.email ?? null,
      active: typeof row.activo === 'number' ? row.activo === 1 : undefined,
      createdAt: row.creado_en ?? row.created_at ?? row.createdAt ?? null,
      updatedAt: row.actualizado_en ?? row.updated_at ?? row.updatedAt ?? null,
      lastLogin: row.ultimo_login ?? null,
    };
  };

  const mapRoute = (entity) => {
    if (!entity) return null;
    const row = typeof entity.get === 'function' ? entity.get({ plain: true }) : entity;
    return {
      id: row.id,
      name: row.name,
      origin_lat: row.origin_lat ?? null,
      origin_lng: row.origin_lng ?? null,
      dest_lat: row.dest_lat ?? null,
      dest_lng: row.dest_lng ?? null,
      created_at: row.created_at ?? row.createdAt ?? null,
      updated_at: row.updated_at ?? row.updatedAt ?? null,
    };
  };

  const normalizeEmail = (email) => (email || '').trim().toLowerCase();
  const isBcryptHash = (value) => typeof value === 'string' && value.startsWith('$2');

  const compareAndMaybeUpgradePassword = async (user, plainPassword) => {
    if (!user || !plainPassword) return false;
    const passwordHash = user.get('pass_hash');
    if (!passwordHash) return false;

    if (isBcryptHash(passwordHash)) {
      return bcrypt.compare(plainPassword, passwordHash);
    }

    const match = passwordHash === plainPassword;
    if (match) {
      try {
        const upgradedHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
        await user.update({ pass_hash: upgradedHash });
      } catch (upgradeError) {
        console.warn('No se pudo actualizar el hash del usuario', upgradeError);
      }
    }
    return match;
  };

  // Usuarios
  app.get('/api/users', async (_req, res, next) => {
    try {
      const users = await Usuario.findAll({
        attributes: ['id_usuario', 'nombre', 'email', 'activo', 'creado_en', 'actualizado_en', 'ultimo_login'],
        order: [['id_usuario', 'DESC']],
      });
      res.json(users.map(mapUser));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/users/:id', async (req, res, next) => {
    try {
      const user = await Usuario.findByPk(req.params.id, {
        attributes: ['id_usuario', 'nombre', 'email', 'activo', 'creado_en', 'actualizado_en', 'ultimo_login'],
      });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      return res.json(mapUser(user));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/users', async (req, res, next) => {
    try {
      const { firstName, lastName, email, password } = req.body || {};
      if (!firstName || !email || !password) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
      }

      const normalizedEmail = normalizeEmail(email);

      const existing = await Usuario.findOne({ where: { email: normalizedEmail }, attributes: ['id_usuario'] });
      if (existing) {
        return res.status(409).json({ message: 'Ya existe un usuario con ese correo' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const fullName = `${firstName.trim()} ${lastName ? lastName.trim() : ''}`.trim();
      const user = await Usuario.create({
        nombre: fullName || firstName.trim(),
        email: normalizedEmail,
        pass_hash: passwordHash,
        activo: 1,
      });
      const userId = user.get('id_usuario');
      const freshUser = await Usuario.findByPk(userId, {
        attributes: ['id_usuario', 'nombre', 'email', 'activo', 'creado_en', 'actualizado_en', 'ultimo_login'],
      });
      res.status(201).json({ user: mapUser(freshUser) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/users/:id', async (req, res, next) => {
    try {
      const deleted = await Usuario.destroy({ where: { id_usuario: req.params.id } });
      if (deleted === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
      }

      const normalizedEmail = normalizeEmail(email);
      const user = await Usuario.findOne({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      const match = await compareAndMaybeUpgradePassword(user, password);
      if (!match) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      await user.update({ ultimo_login: new Date() });

      res.json({ user: mapUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/users/:id/password', async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Contraseña actual y nueva son obligatorias' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }

      const user = await Usuario.findByPk(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const match = await compareAndMaybeUpgradePassword(user, currentPassword);
      if (!match) {
        return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await user.update({ pass_hash: newHash });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // CRUD para la tabla `routes`
  app.get('/api/routes', async (_req, res, next) => {
    try {
      const routes = await Route.findAll({ order: [['id', 'DESC']] });
      res.json(routes.map(mapRoute));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/routes/:id', async (req, res, next) => {
    try {
      const route = await Route.findByPk(req.params.id);
      if (!route) {
        return res.status(404).json({ message: 'Ruta no encontrada' });
      }
      return res.json(mapRoute(route));
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/routes', async (req, res, next) => {
    const { name, originLat, originLng, destLat, destLng } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'El campo "name" es obligatorio' });
    }
    try {
      const route = await Route.create({
        name,
        origin_lat: originLat ?? null,
        origin_lng: originLng ?? null,
        dest_lat: destLat ?? null,
        dest_lng: destLng ?? null,
      });
      res.status(201).json(mapRoute(route));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/routes/:id', async (req, res, next) => {
    const { name, originLat, originLng, destLat, destLng } = req.body;
    try {
      const [updatedCount] = await Route.update(
        {
          name: name ?? null,
          origin_lat: originLat ?? null,
          origin_lng: originLng ?? null,
          dest_lat: destLat ?? null,
          dest_lng: destLng ?? null,
        },
        { where: { id: req.params.id } },
      );
      if (updatedCount === 0) {
        return res.status(404).json({ message: 'Ruta no encontrada' });
      }
      const refreshed = await Route.findByPk(req.params.id);
      return res.json(mapRoute(refreshed));
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/routes/:id', async (req, res, next) => {
    try {
      const deleted = await Route.destroy({ where: { id: req.params.id } });
      if (deleted === 0) {
        return res.status(404).json({ message: 'Ruta no encontrada' });
      }
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  app.use((err, _req, res, _next) => {
    console.error('[API ERROR]', err);
    res.status(500).json({ message: 'Error interno', detail: err.message });
  });

  const server = app.listen(config.server.port, () => {
    console.log(`API local escuchando en http://localhost:${config.server.port}`);
  });

  appInstance = { app, server };
  return appInstance;
}

module.exports = createServer;
