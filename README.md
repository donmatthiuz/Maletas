# Maletas · Manifiestos y bauchers

Aplicación web enfocada en generar e imprimir los documentos del libro Excel `MANIFIESTO MALETAS...xlsm`. Usa React en el frontend, FastAPI en la API y MongoDB para persistencia.

## Qué replica del Excel

- Creación de manifiestos con fecha y encargado.
- Creación de varias maletas dentro de cada manifiesto.
- Registro de varios bauchers dentro de cada maleta.
- Edición, eliminación y ordenamiento persistente de bauchers.
- Directorio independiente para registrar y editar direcciones.
- Asignación aleatoria de destino sin repetir direcciones dentro del manifiesto.
- Vista previa e impresión multipágina de las maletas en A4 horizontal.
- Impresión de un baucher, una maleta o todos los bauchers del manifiesto en A4 vertical.
- Traducción automática completa español→inglés, conservando las equivalencias de la macro.
- Formatos, columnas y proporciones recuperados de las hojas `Manifiesto` y `Bauncher`.

La primera vez que arranca un MongoDB vacío, la API importa automáticamente las 99 direcciones y los 38 envíos del libro original. En arranques posteriores no duplica registros.

## Modos Docker

Requisitos: Docker y Docker Compose.

### Frontend testing/local

Usa el frontend en modo `testing`, la API y el contenedor local `mongo`. Importa el XLSM cuando la base está vacía y conserva los datos en el volumen `mongo_data`:

```bash
docker compose up --build
```

Abre:

- Aplicación: http://localhost:8080
- Documentación API: http://localhost:8080/api/v1/docs
- Estado API: http://localhost:8080/api/v1/health

Para detener el stack:

```bash
docker compose down
```

Los datos permanecen en el volumen `mongo_data`. Para arrancar con una base totalmente vacía, elimina expresamente ese volumen con `docker compose down -v`.

El endpoint de salud muestra `"environment": "testing"`.

### Frontend con la API de Render

Construye solamente el frontend en modo `render`. Las peticiones se envían directamente a `https://maletas-backend.onrender.com/api/v1`, por lo que no levanta una API ni una base de datos local:

```bash
docker compose -f docker-compose.render.yml up --build -d
```

Abre http://localhost:8080. Para detenerlo:

```bash
docker compose -f docker-compose.render.yml down
```

Los modos testing y Render usan proyectos Docker separados. Si quieres ejecutarlos simultáneamente, cambia el puerto del segundo:

```bash
APP_PORT=5173 docker compose -f docker-compose.render.yml up --build -d
```

### Producción con MongoDB Atlas

Requisitos previos:

1. Crear o migrar Atlas con [mongo_produ/setup.js](mongo_produ/setup.js).
2. Guardar `MONGO_URL` y `MONGO_DATABASE` en `mongo_produ/.env`.
3. Configurar el dominio permitido mediante `CORS_ORIGINS`.

Arranque:

```bash
CORS_ORIGINS=https://tu-dominio.com \
docker compose -f docker-compose.production.yml up --build -d
```

Este modo:

- No crea un contenedor MongoDB.
- Usa exclusivamente la conexión Atlas de `mongo_produ/.env`.
- No vuelve a importar el XLSM (`SEED_FROM_WORKBOOK=false`).
- Ejecuta Uvicorn con dos workers por defecto.
- Rechaza el arranque si `APP_ENV=production` apunta a `localhost` o `mongo:27017`.

Para cambiar el puerto o número de workers:

```bash
APP_PORT=8081 API_WORKERS=4 CORS_ORIGINS=https://tu-dominio.com \
docker compose -f docker-compose.production.yml up --build -d
```

Para detener producción:

```bash
docker compose -f docker-compose.production.yml down
```

Testing y producción usan nombres de proyecto diferentes. Pueden coexistir si se asignan puertos distintos.

## Desarrollo local

### API

Con MongoDB disponible en `localhost:27017`:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
APP_ENV=testing MONGO_URL=mongodb://localhost:27017 SOURCE_WORKBOOK="../MANIFIESTO MALETAS 21 DE AGOSTO DE 2026 (1).xlsm" uvicorn app.main:app --reload
```

### Frontend

API local mediante el proxy de Vite:

```bash
cd frontend
npm install
npm run dev:testing
```

Vite redirige `/api` a la API local en el puerto `8000`. Para usar directamente la API desplegada en Render:

```bash
npm run dev:render
```

Los builds equivalentes son `npm run build:testing` y `npm run build:render`.

## API principal

- `GET/POST /api/v1/manifests`
- `GET/POST /api/v1/manifests/{id}/bags`
- `GET /api/v1/bags/{id}/shipments`
- `PUT /api/v1/bags/{id}/shipments/order`
- `GET/POST /api/v1/shipments`
- `GET/PATCH/DELETE /api/v1/shipments/{id}`
- `GET /api/v1/shipments/export.csv`
- `GET/POST /api/v1/addresses`
- `PATCH /api/v1/addresses/{id}`
- `GET /api/v1/manifests?bag_number=1`
- `GET /api/v1/stats`
- `POST /api/v1/translate`

## Estructura

```text
backend/       FastAPI, importador XLSM y pruebas
frontend/      React + Vite, interfaz responsive e impresión
design-system/ Decisiones visuales generadas con UI/UX Pro Max
docker-compose.yml
docker-compose.production.yml
docker-compose.render.yml
mongo_produ/   Scripts y configuración de MongoDB Atlas
```
