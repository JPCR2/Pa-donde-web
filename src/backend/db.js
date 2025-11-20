const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

async function initPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const connection = await initPool();
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  query,
  closePool,
};
