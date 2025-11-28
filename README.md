# Padondep

Aplicacion Electron que combina un backend Express con renderer Leaflet para planificar rutas en Playa del Carmen.

## Requisitos previos

- Node.js 18 o superior (incluye `npm` y soporte nativo para `fetch`).
- Base de datos MySQL accesible con el esquema que se encuentra en `src/backend/schema.sql`.
- Servicio OSRM (Open Source Routing Machine) disponible. Puedes usar el servicio publico `https://router.project-osrm.org` para pruebas o levantar un contenedor local.

## Configuración

1. Copia `.env.example` a `.env` y ajusta las variables segun tu entorno:
   - Credenciales y nombre de base de datos MySQL (`DB_*`).
   - Puerto del API interno (`API_PORT`).
   - URL del servicio OSRM (`OSRM_URL`) y, opcionalmente, perfil y tiempo de espera.
2. Instala dependencias:
   ```powershell
   cd D:\Documentos\Padondep
   npm install
   ```
3. Inicia el servicio OSRM (ejemplo con Docker y extracto de Mexico):
   ```powershell
   docker run -t -i -p 5000:5000 osrm/osrm-backend powershell -Command "\
     curl https://download.geofabrik.de/north-america/mexico-latest.osm.pbf -o /data/mexico.osm.pbf; \
     osrm-extract -p /opt/car.lua /data/mexico.osm.pbf; \
     osrm-partition /data/mexico.osrm; \
     osrm-customize /data/mexico.osrm; \
     osrm-routed --algorithm=MLD /data/mexico.osrm"
   ```
   Ajusta el extracto y comandos segun la region que necesites.

## Ejecución

```powershell
cd D:\Documentos\Padondep
npm start
```

El comando ejecuta `electron-forge start`, levanta la API interna y abre la ventana de la app. Despues de iniciar sesion selecciona origen y destino para solicitar la ruta a OSRM.

## Pruebas rápidas del backend

Para verificar que la API levanta sin abrir la UI puede ejecutarse:

```powershell
cd D:\Documentos\Padondep
node -e "const srv=require('./src/backend/server'); const instance=srv(); setTimeout(()=>instance.server.close(), 1000);"
```

Revisa la consola para asegurarte de que no hay errores al inicializar la conexión MySQL ni al cargar OSRM.

## Corrección
Se hizo la corrección del CRUD , lo cual falto el de Actualizar y el de Eliminar.
Se agrego junto con la base de datos para que nos pueda dejar ya sea en el electron y en la base de datos poder realizar el CRUD
que los cambios estan en el archivo de server.js.
