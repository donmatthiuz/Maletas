# Maletas · Centro de operaciones

Aplicación web que reemplaza el flujo del libro Excel `MANIFIESTO MALETAS...xlsm` con una interfaz React, una API FastAPI y persistencia en MongoDB.

## Qué replica del Excel

- Registro de paquetes por número de maleta.
- Catálogo numerado de direcciones y teléfonos (hoja `DATABASE`).
- Tabla operativa de envíos (hoja `GRADLE`).
- Generación de manifiestos por maleta con tipo `UNSOLICITED` y cantidad `2`.
- Búsqueda y modificación por código.
- Etiqueta individual lista para imprimir (hoja `Bauncher`).
- Traducción de contenidos mediante el diccionario recuperado de las macros VBA.

La primera vez que arranca un MongoDB vacío, la API importa automáticamente las 99 direcciones y los 38 envíos del libro original. En arranques posteriores no duplica registros.

## Arranque con Docker

Requisitos: Docker y Docker Compose.

```bash
docker compose up --build
```

Abre:

- Aplicación: http://localhost:8080
- Documentación API: http://localhost:8080/api/docs
- Estado API: http://localhost:8080/api/v1/health

Para detener el stack:

```bash
docker compose down
```

Los datos permanecen en el volumen `mongo_data`. Para arrancar con una base totalmente vacía, elimina expresamente ese volumen con `docker compose down -v`.

## Desarrollo local

### API

Con MongoDB disponible en `localhost:27017`:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
MONGO_URL=mongodb://localhost:27017 SOURCE_WORKBOOK="../MANIFIESTO MALETAS 21 DE AGOSTO DE 2026 (1).xlsm" uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite redirige `/api` a la API local en el puerto `8000`.

## API principal

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
```
