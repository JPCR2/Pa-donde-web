const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pa',
  },
  osrm: {
    baseUrl: (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, ''),
    profile: process.env.OSRM_PROFILE || 'driving',
    requestTimeoutMs: Number(process.env.OSRM_TIMEOUT_MS || 10000),
  },
  server: {
    port: Number(process.env.API_PORT || 4799),
  },
};
