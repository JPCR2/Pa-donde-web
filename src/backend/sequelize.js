const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

const {
  database: mysqlDatabase = 'projec_padddd',
  user: mysqlUser,
  password: mysqlPassword,
  host: mysqlHost,
  port: mysqlPort,
} = config.mysql;

const sequelize = new Sequelize(mysqlDatabase, mysqlUser, mysqlPassword, {
  host: mysqlHost,
  port: mysqlPort,
  dialect: 'mysql',
  logging: false,
  define: {
    freezeTableName: true,
  },
});

const Usuario = sequelize.define(
  'usuario',
  {
    id_usuario: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    pass_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    activo: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    actualizado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    ultimo_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'usuario',
    timestamps: true,
    createdAt: 'creado_en',
    updatedAt: 'actualizado_en',
  },
);

const Route = sequelize.define(
  'routes',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    origin_lat: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
    },
    origin_lng: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
    },
    dest_lat: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
    },
    dest_lng: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  },
  {
    tableName: 'routes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

async function initialize() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log(`[Sequelize] Conectado a MySQL (${mysqlHost}:${mysqlPort}) base ${mysqlDatabase}`);
  } catch (error) {
    console.error('Error inicializando Sequelize:', error);
  }
}

initialize();

module.exports = {
  sequelize,
  Usuario,
  Route,
  DataTypes,
};
