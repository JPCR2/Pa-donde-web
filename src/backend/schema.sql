-- Usa la base de datos "pa" configurada en XAMPP
USE pa;


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
