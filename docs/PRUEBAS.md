# Evidencias de validación

Fecha: 2026-08-28

## Pruebas automatizadas

```text
pytest: 5 passed
vite build: aprobado, 1601 módulos transformados
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

## Prueba integral temporal

Se creó mediante la API:

1. Un manifiesto temporal.
2. La maleta #77 dentro del manifiesto.
3. Un baucher dentro de la maleta.

Se verificaron `manifest_id`, `bag_id`, número, fecha y encargado heredados. Todos los datos temporales fueron eliminados al finalizar.

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
- Pestañas `Documentos` y `Direcciones`: visibles y navegables.
- Modal `Nuevo manifiesto`: accesible.
- Modal `Agregar maleta`: 2 campos disponibles.
- Modal `Agregar baucher`: contexto de manifiesto/maleta, 99 direcciones y acción `Traducir`.
- Desbordamiento horizontal móvil: no detectado.

## Impresión PDF

- Manifiesto completo: 3 páginas A4 horizontales, una por maleta.
- Bauchers de la maleta #1: 15 páginas A4 verticales, una por baucher.
