-- Usa la base de datos existente en XAMPP
USE projec_padddd;

-- Tabla para almacenar rutas simples de origen/destino
CREATE TABLE IF NOT EXISTS routes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  origin_lat DECIMAL(10,6) NULL,
  origin_lng DECIMAL(10,6) NULL,
  dest_lat DECIMAL(10,6) NULL,
  dest_lng DECIMAL(10,6) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Tabla de usuarios (estructura existente en XAMPP)
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(160) NOT NULL,
  email VARCHAR(120) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ultimo_login DATETIME DEFAULT NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY unique_email (email)
);
