# Evidencias de validación

Fecha: 2026-08-29

## Pruebas automatizadas

```text
pytest: 14 passed
Playwright: 7 passed
vite build: aprobado, 1606 módulos transformados
git diff --check: sin errores de espacios o parches
```

## Docker

Servicios esperados:

- `maletas-mongo-1`: healthy.
- `maletas-api-1`: healthy.
- `maletas-frontend-1`: disponible en el puerto 8080.

## Datos migrados

La base existente quedó organizada así:

```text
Manifiesto 2026-08-28
├── Maleta #1: 15 bauchers
├── Maleta #2: 15 bauchers
└── Maleta #3: 8 bauchers
```

Total conservado: 38 bauchers y 99 direcciones.

## Prueba integral de API

Se creó mediante la API:

1. Un manifiesto temporal.
2. La maleta #77 dentro del manifiesto.
3. Dos bauchers sin enviar `address_number`.

Se verificaron dos direcciones aleatorias distintas, órdenes iniciales `1` y `2`, reordenamiento persistente, edición conservando el destino y eliminación. Todos los datos temporales fueron eliminados al finalizar.

## Traducción

Entrada:

```text
camisas, pantalones y juguetes para niños
```

Salida verificada dentro de Docker:

```text
KIDS' SHIRTS, PANTS AND TOYS
```

También se probaron las equivalencias deterministas del Excel y el comportamiento sin conexión.

## Interfaz

Pruebas con Chromium:

- Escritorio: 1440 × 1000.
- Móvil: 375 × 812.
- Navegación `Manifiestos y maletas`, `Bauchers` y `Direcciones`: visible y operable.
- Modal `Nuevo manifiesto`: accesible.
- Modal `Editar manifiesto`: carga el nombre y la fecha actuales y permite guardar ambos campos.
- Modal `Agregar maleta`: número, nombre opcional y nombre de quien envía obligatorio.
- Acción `Editar maleta`: permite cambiar el remitente y la vista previa usa inmediatamente el valor de la maleta.
- La acción `Editar maleta` también está disponible desde la sección `Bauchers` y abre el mismo formulario.
- `Agregar baucher` aparece dentro de la sección Bauchers, no como acción global.
- Acciones de editar, eliminar, arrastrar, subir y bajar: visibles.
- Modal `Agregar baucher`: contexto de manifiesto/maleta, destino automático y acción `Traducir`.
- El formulario de baucher muestra precio editable con valor predeterminado `2`.
- Desbordamiento horizontal: no detectado en 375 × 812 ni 812 × 375 con movimiento reducido.

## Impresión PDF

- Manifiesto completo: 3 páginas A4 horizontales, una por maleta.
- Todos los bauchers del manifiesto importado: 38 páginas A4 verticales, una por baucher.
- La fila `Content` crece con un texto de prueba extenso y conserva todo el contenido visible.
- La hoja de maleta muestra precios como `$2` y `UNSOLICITED` completo en su columna ampliada.
- Maleta temporal con 16 bauchers: 2 páginas A4 horizontales.
- El orden movido con el control `Bajar` apareció inmediatamente como primer renglón de la hoja de la maleta.

Todos los manifiestos, maletas y bauchers creados para las pruebas fueron eliminados al terminar.

## Ajustes posteriores

- La última columna de la hoja de maleta se trata como precio editable, parte de `2` y se imprime con `$`; la columna `UNSOLICITED` se desplazó hacia la izquierda para evitar recortes.
- La altura de `Content` conserva el mínimo recuperado del Excel, pero ahora puede crecer para contenidos extensos.
- El remitente se trasladó del manifiesto a cada maleta. La migración heredó los valores existentes y `PATCH /bags/{bag_id}` sincroniza el cambio con sus bauchers.
- El baucher se amplió a `184mm` de ancho, manteniendo sus columnas y alturas proporcionales dentro del A4 vertical y usando márgenes laterales de `13mm` para dar más espacio a las direcciones.
- Después de crear un baucher se verificó una confirmación de solo lectura con el número de dirección, dirección completa y teléfono asignados por la API.
