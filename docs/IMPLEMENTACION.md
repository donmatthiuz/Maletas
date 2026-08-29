# Implementación del sistema de manifiestos

Última actualización: 2026-08-28

## Objetivo funcional

El sistema replica el flujo documental del libro Excel con esta jerarquía:

```text
Manifiesto
└── Una o varias maletas
    └── Uno o varios bauchers
```

No es un tracker de entregas. Su función principal es registrar información, generar los documentos y permitir su impresión con el formato del archivo original.

## Arquitectura

- Frontend: React 19 + Vite.
- Backend: Python + FastAPI.
- Base de datos: MongoDB.
- Infraestructura local: Docker Compose con servicios `frontend`, `api` y `mongo`.
- Traducción: `deep-translator` español→inglés con dos proveedores (`GoogleTranslator` y `MyMemoryTranslator`), además del diccionario recuperado de la macro VBA como vocabulario prioritario y respaldo sin conexión.

## Modelo de datos

### `manifests`

- `name`: nombre visible del manifiesto.
- `manifest_date`: fecha común del documento.
- `attendant`: encargado común.
- `created_at`, `updated_at`.

### `bags`

- `manifest_id`: manifiesto al que pertenece.
- `number`: número único dentro del manifiesto.
- `name`: nombre opcional; por defecto `Maleta #N`.
- `created_at`, `updated_at`.

### `shipments`

Cada registro representa un baucher. Conserva los campos del Excel y añade:

- `manifest_id`.
- `bag_id`.
- `bag_number` desnormalizado para impresión.

### `addresses`

- `number`: número utilizado por el flujo original.
- `address`: dirección completa.
- `phone`: teléfono asociado.

## Migración automática

Los envíos importados previamente desde el XLSM no se eliminan. Al iniciar la API:

1. Se agrupan por fecha dentro de un manifiesto importado.
2. Se crea una entidad de maleta por cada número encontrado.
3. Cada envío recibe sus referencias `manifest_id` y `bag_id`.

La migración es idempotente: solo completa registros que todavía no tienen jerarquía.

## Flujo de interfaz

- Pestaña `Documentos`:
  1. Seleccionar o crear manifiesto.
  2. Seleccionar o agregar maleta dentro del manifiesto.
  3. Agregar bauchers dentro de la maleta.
  4. Previsualizar e imprimir.
- Pestaña `Direcciones`:
  - Buscar direcciones.
  - Registrar nuevas direcciones.
  - Editar direcciones existentes.
  - Sincronizar cambios con los bauchers relacionados.

## Impresión

- Manifiesto: A4 horizontal, una hoja por maleta del manifiesto.
- Bauchers: A4 vertical, un baucher por página.
- Se puede imprimir un baucher individual o todos los de la maleta seleccionada.
- Durante la impresión se oculta por completo la interfaz web.

## Traducción

El contenido se traduce automáticamente al guardar un baucher y también puede traducirse manualmente desde el formulario.

Orden de resolución:

1. Si el contenido coincide con una equivalencia aduanera del Excel, se usa esa traducción exacta.
2. Para cualquier otra frase se intenta `GoogleTranslator` con origen español y destino inglés.
3. Si Google no devuelve traducción, se intenta `MyMemoryTranslator`.
4. Si ambos proveedores están fuera de línea, se aplican las equivalencias conocidas y se conserva normalizado el resto; el registro nunca se pierde por un fallo de red.

Ejemplo verificado:

```text
camisas, pantalones y juguetes para niños
→ CHILDREN'S SHIRTS, PANTS AND TOYS
```

## Endpoints añadidos

- `GET /api/v1/manifests`
- `POST /api/v1/manifests`
- `GET /api/v1/manifests/{manifest_id}/bags`
- `POST /api/v1/manifests/{manifest_id}/bags`
- `GET /api/v1/bags/{bag_id}/shipments`
- `POST /api/v1/translate`

Los endpoints existentes de direcciones y envíos se mantienen.

## Estado de validación

- Build React: aprobado.
- Pruebas unitarias backend: 5 aprobadas.
- Traducción general real: verificada.
- Docker Compose: reconstruido correctamente.
- Prueba integral API Manifiesto → Maleta → Baucher: aprobada y datos temporales eliminados.
- Traducción dentro de Docker: aprobada mediante el proveedor de respaldo.
- Revisión visual: aprobada a 1440 px y 375 px.
- Desbordamiento horizontal móvil en Documentos y Direcciones: no detectado.
- Impresión jerárquica: 3 maletas generan 3 hojas de manifiesto.
- Formulario de maleta: número y nombre opcional disponibles.
- Formulario de baucher: contexto heredado del manifiesto, 99 direcciones disponibles y traducción visible.
- PDF de manifiesto: 3 páginas A4 horizontales verificadas.
- PDF de bauchers: 15 páginas A4 verticales verificadas para la maleta #1.
