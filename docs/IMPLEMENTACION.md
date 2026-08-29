# Implementación del sistema de manifiestos

Última actualización: 2026-08-29

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
- `print_order`: posición persistente dentro de la maleta.

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

- Sección `Manifiestos y maletas`:
  1. Crear o seleccionar un manifiesto.
  2. Agregar una o varias maletas.
  3. Previsualizar una o varias hojas por maleta.
  4. Imprimir la maleta seleccionada, el manifiesto completo o todos sus bauchers.
- Sección `Bauchers`:
  - Agregar, editar y eliminar bauchers.
  - Reordenar por arrastre, teclado o botones subir/bajar.
  - Imprimir un baucher o todos los de la maleta.
- Sección `Direcciones`:
  - Buscar direcciones.
  - Registrar nuevas direcciones.
  - Editar direcciones existentes.
  - Sincronizar cambios con los bauchers relacionados.

## Impresión

- Manifiesto: A4 horizontal, 15 bauchers por hoja y tantas hojas como necesite cada maleta.
- Bauchers: A4 vertical, un baucher por página.
- Se puede imprimir un baucher, una maleta, todo el manifiesto o todos los bauchers del manifiesto.
- Durante la impresión se oculta por completo la interfaz web.

Las medidas recuperadas del XLSM y la justificación de los elementos que sí forman parte del papel están en `docs/IMPRESION_Y_ORDEN.md`.

## Asignación de destino

- El formulario no permite elegir manualmente la dirección de destino.
- La API selecciona aleatoriamente una dirección todavía no utilizada dentro del mismo manifiesto.
- La dirección permanece estable al editar el baucher.
- Inmediatamente después de crear el baucher, una confirmación de solo lectura muestra el número, la dirección y el teléfono asignados.
- Cuando se agotan las direcciones disponibles, la creación se detiene con un error recuperable.

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
- `PUT /api/v1/bags/{bag_id}/shipments/order`
- `POST /api/v1/translate`

Los endpoints existentes de direcciones y envíos se mantienen.

## Estado de validación

- Build React: aprobado.
- Pruebas unitarias backend: 5 aprobadas.
- Traducción general real: verificada.
- Docker Compose: reconstruido correctamente.
- Prueba integral API Manifiesto → Maleta → Baucher: aprobada y datos temporales eliminados.
- Traducción dentro de Docker: aprobada mediante el proveedor de respaldo.
- Revisión visual: aprobada a 1440 px, 375 px y móvil horizontal con movimiento reducido.
- Desbordamiento horizontal móvil en las tres secciones: no detectado.
- Impresión jerárquica: una maleta temporal con 16 bauchers generó exactamente 2 hojas.
- Formulario de maleta: número y nombre opcional disponibles.
- Formulario de baucher: contexto heredado, destino automático de solo lectura y traducción visible.
- PDF de manifiesto: 3 páginas A4 horizontales verificadas.
- PDF de todos los bauchers: 38 páginas A4 verticales verificadas.
- Prueba integral de API: direcciones aleatorias distintas, edición conservando destino, reordenamiento persistente y eliminación aprobados.
- Playwright: 3 pruebas de interfaz e impresión aprobadas.
