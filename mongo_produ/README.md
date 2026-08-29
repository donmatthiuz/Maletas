# MongoDB Atlas · estructura de producción

Esta carpeta crea la estructura vacía de la base `maletas` en MongoDB Atlas. No contiene contraseñas ni copia datos locales.

## Contenido

- `setup.js`: crea o actualiza colecciones, validadores e índices.
- `verify.js`: comprueba que la estructura exista.
- `verify-data.js`: comprueba conteos y relaciones sin mostrar información personal.
- `.env.example`: ejemplo de la URI requerida por la API.

## 1. Preparar Atlas

1. Crea un cluster en MongoDB Atlas.
2. En `Database Access`, crea un usuario de instalación con permisos `readWrite` y `dbAdmin` sobre la base `maletas`. La API solamente necesita `readWrite` después de crear la estructura.
3. En `Network Access`, autoriza la IP desde la cual ejecutarás el script y la IP del servidor donde funcionará la API.
4. Copia la URI de conexión del cluster.

## 2. Crear la estructura

Con `mongosh` instalado, desde la raíz del proyecto ejecuta:

```bash
mongosh "mongodb+srv://USUARIO:CLAVE@CLUSTER.mongodb.net/?retryWrites=true&w=majority" \
  --file mongo_produ/setup.js
```

El script puede ejecutarse nuevamente sin duplicar colecciones ni índices.

## 3. Verificar

```bash
mongosh "mongodb+srv://USUARIO:CLAVE@CLUSTER.mongodb.net/?retryWrites=true&w=majority" \
  --file mongo_produ/verify.js
```

## 4. Conectar la API

Configura estas variables en el servicio de producción:

```env
MONGO_URL=mongodb+srv://USUARIO:CLAVE@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGO_DATABASE=maletas
```

El archivo `docker-compose.production.yml` del proyecto carga automáticamente estas variables y establece `APP_ENV=production`.

No subas una URI con usuario y contraseña al repositorio. Guárdala como variable secreta en el proveedor donde despliegues la API.

## Estructura creada

```text
maletas
├── manifests
│   └── _id ← bags.manifest_id y shipments.manifest_id
├── bags
│   ├── attendant (nombre de quien envía la maleta)
│   └── _id ← shipments.bag_id
├── shipments
└── addresses
```

MongoDB crea físicamente la base cuando se crea la primera colección. `setup.js` realiza esa operación, por lo que no es necesario crear `maletas` manualmente desde la interfaz de Atlas.
