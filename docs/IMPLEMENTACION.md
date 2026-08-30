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
- `created_at`, `updated_at`.

### `bags`

- `manifest_id`: manifiesto al que pertenece.
- `number`: número único dentro del manifiesto.
- `name`: nombre opcional; por defecto `Maleta #N`.
- `attendant`: nombre de quien envía la maleta; es propio de cada maleta y puede editarse.
- `created_at`, `updated_at`.

### `shipments`

Cada registro representa un baucher. Conserva los campos del Excel y añade:

- `manifest_id`.
- `bag_id`.
- `bag_number` desnormalizado para impresión.
- `print_order`: posición persistente dentro de la maleta.
- `quantity`: precio entero editable; su valor predeterminado es `2` y se imprime con el prefijo `$`.

### `addresses`

- `number`: número utilizado por el flujo original.
- `address`: dirección completa.
- `phone`: teléfono asociado.

## Migración automática

Los envíos importados previamente desde el XLSM no se eliminan. Al iniciar la API:

1. Se agrupan por fecha dentro de un manifiesto importado.
2. Se crea una entidad de maleta por cada número encontrado.
3. Cada maleta hereda el nombre de quien envía desde los datos importados o, para datos de versiones anteriores, desde el antiguo valor del manifiesto.
4. Cada envío recibe sus referencias `manifest_id` y `bag_id`.

La migración es idempotente: completa referencias y remitentes faltantes, y mantiene sincronizado el remitente de cada maleta con sus bauchers.

## Flujo de interfaz

- Sección `Manifiestos y maletas`:
  1. Crear o seleccionar un manifiesto.
  2. Editar el nombre o la fecha del manifiesto; el cambio de fecha se sincroniza con todos sus bauchers.
  3. Agregar una o varias maletas indicando el nombre de quien envía.
  4. Editar una maleta y cambiar su remitente cuando sea necesario.
  5. Previsualizar una o varias hojas por maleta.
  6. Imprimir la maleta seleccionada, el manifiesto completo o todos sus bauchers.
- Sección `Bauchers`:
  - Agregar, editar y eliminar bauchers.
  - Editar directamente la maleta seleccionada, incluido el nombre de quien envía.
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
- Después de crear el baucher, el formulario permanece abierto para registrar el siguiente. Se limpian código, remitente y destinatario; se conservan la dirección en Guatemala, el contenido y el precio. La dirección de destino continúa asignándose automáticamente, sin mostrar un modal adicional.
- Tanto al agregar como al editar, el botón `Imprimir este baucher` guarda primero los datos actuales y luego abre la impresión del baucher confirmado por la API.
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
- `PATCH /api/v1/manifests/{manifest_id}`
- `GET /api/v1/manifests/{manifest_id}/bags`
- `POST /api/v1/manifests/{manifest_id}/bags`
- `PATCH /api/v1/bags/{bag_id}`
- `GET /api/v1/bags/{bag_id}/shipments`
- `PUT /api/v1/bags/{bag_id}/shipments/order`
- `POST /api/v1/translate`

Los endpoints existentes de direcciones y envíos se mantienen.

## Estado de validación

- Build React: aprobado.
- Pruebas unitarias backend: 14 aprobadas.
- Traducción general real: verificada.
- Docker Compose: reconstruido correctamente.
- Prueba integral API Manifiesto → Maleta → Baucher: aprobada y datos temporales eliminados.
- Traducción dentro de Docker: aprobada mediante el proveedor de respaldo.
- Revisión visual: aprobada a 1440 px, 375 px y móvil horizontal con movimiento reducido.
- Desbordamiento horizontal móvil en las tres secciones: no detectado.
- Impresión jerárquica: una maleta temporal con 16 bauchers generó exactamente 2 hojas.
- Formulario de maleta: número, nombre opcional y nombre obligatorio de quien envía disponibles al crear y editar.
- Formulario de manifiesto: nombre y fecha disponibles al crear y editar; la fecha actualizada se propaga a sus bauchers.
- Formulario de baucher: contexto heredado, destino automático de solo lectura, traducción visible y precio editable con valor inicial `2`.
- Contenido largo: la celda `Content` del baucher aumenta su altura automáticamente sin recortar el texto.
- Hoja de maleta: precio con símbolo `$` y columna `UNSOLICITED` ampliada y desplazada hacia la izquierda.
- PDF de manifiesto: 3 páginas A4 horizontales verificadas.
- PDF de todos los bauchers: 38 páginas A4 verticales verificadas.
- Prueba integral de API: direcciones aleatorias distintas, edición conservando destino, reordenamiento persistente y eliminación aprobados.
- Playwright: 7 pruebas de interfaz e impresión aprobadas.
- Migración local verificada: las maletas existentes recibieron su remitente y los manifiestos ya no lo exponen como dato propio.
- Edición de remitente por `PATCH /bags/{bag_id}` verificada, incluida la sincronización con los bauchers relacionados.
