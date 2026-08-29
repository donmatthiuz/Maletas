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

## Arranque con Docker

Requisitos: Docker y Docker Compose.

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
```
