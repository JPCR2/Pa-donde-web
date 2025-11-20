const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { Usuario, Route } = require('./sequelize');

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

      const passwordHash = await bcrypt.hash(password, 10);
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

      const passwordHash = user.get('pass_hash');
      let match = false;

      if (isBcryptHash(passwordHash)) {
        match = await bcrypt.compare(password, passwordHash);
      } else if (passwordHash != null) {
        match = passwordHash === password;
        if (match) {
          try {
            const upgradedHash = await bcrypt.hash(password, 10);
            await user.update({ pass_hash: upgradedHash });
          } catch (upgradeError) {
            console.warn('No se pudo actualizar el hash del usuario', upgradeError);
          }
        }
      }

      if (!match) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }

      await user.update({ ultimo_login: new Date() });

      res.json({ user: mapUser(user) });
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
