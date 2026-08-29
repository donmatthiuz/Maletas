# Impresión exacta, orden y direcciones

Fecha de inicio: 2026-08-28

## Alcance solicitado

- Igualar las impresiones reales de `Manifiesto` y `Bauncher` al XLSM original.
- Permitir varias hojas para una misma maleta.
- Permitir reordenar los bauchers desde el resumen y conservar ese orden al imprimir.
- Permitir editar y eliminar bauchers.
- Asignar la dirección de destino automáticamente y sin repetición dentro del mismo manifiesto.

## Mediciones recuperadas del XLSM

### Hoja `Manifiesto`

- Orientación: horizontal.
- Escala guardada: 23 %.
- Márgenes: 0.2362204724 pulgadas en los cuatro lados; encabezado y pie 0.1968503937.
- Centrado horizontal: activado.
- Anchos de columnas A:H:
  - 32.7109375
  - 72.140625
  - 69.140625
  - 70.85546875
  - 129.42578125
  - 116.85546875
  - 46.42578125
  - 44.28515625
- Encargado y metadatos: Calibri negrita de 72 pt antes de aplicar la escala.
- Datos: Arial Narrow de 38 pt antes de aplicar la escala, alineados arriba y con ajuste de texto.
- No existen rellenos ni bordes visibles en el cuerpo.
- El archivo organiza 15 bauchers en el primer bloque de maleta; se adopta `15` como capacidad máxima por hoja impresa y se repiten encabezado, fecha y número de maleta en cada página adicional.
- La marca `Página N` visible dentro de Excel pertenece a `pageBreakPreview`; no forma parte del papel y no se agregará como marca de agua artificial.

### Hoja `Bauncher`

- Orientación: vertical.
- Papel: A4.
- Márgenes: izquierda/derecha 0.7 pulgadas; arriba/abajo 0.75; encabezado/pie 0.3.
- Rango impreso por la macro: `A1:D7`.
- Anchos de columnas A:D:
  - 14.85546875
  - 25.7109375
  - 23.5703125
  - 5.28515625
- Ancho calculado del rango: aproximadamente 486 px de Excel, equivalente a 128.6 mm a 96 dpi.
- Alturas de filas 1:7: 17.25, 19.5, 19.5, 19.5, 19.5, 18.75 y 39 pt.
- Tipografía: Calibri 15 pt.
- Bordes: línea fina negra en toda la cuadrícula.
- Celdas combinadas: `B2:D2` hasta `B7:D7`.
- El pie auxiliar `Atendido` y la fecha fuera de A1:D7 no forman parte del rango que imprime la macro.

## Reglas funcionales decididas

- `print_order` será un entero persistente dentro de cada maleta.
- La API devolverá los bauchers ordenados por `print_order` y luego por fecha de creación.
- El reordenamiento tendrá arrastre y alternativas de mover arriba/abajo para teclado y pantallas táctiles.
- Al crear un baucher, la API elegirá aleatoriamente una dirección cuyo número aún no aparezca en ningún baucher del mismo manifiesto.
- Al editar un baucher se conservará su dirección actual.
- Si no quedan direcciones disponibles, la API responderá con un error claro y no creará el baucher.

## Implementación terminada

- Cada maleta se pagina en bloques de 15 bauchers. El encabezado, la fecha y el número de maleta se repiten en todas las hojas.
- La previsualización muestra `Hoja N de M` sin incorporar esa etiqueta al documento impreso.
- `PUT /api/v1/bags/{bag_id}/shipments/order` persiste el orden completo de una maleta.
- El listado permite arrastrar con mouse/táctil, reordenar con teclado y usar botones visibles de subir/bajar.
- La edición conserva la dirección asignada; la eliminación requiere confirmación.
- La creación ya no presenta un selector de destino. La API elige con `$sample` entre las direcciones todavía no usadas en el manifiesto.
- Hay acciones separadas para imprimir una maleta, todo el manifiesto, los bauchers de una maleta, todos los bauchers del manifiesto y un baucher individual.

## Correspondencia de impresión verificada

- Manifiesto: A4 horizontal, márgenes de `0.2362204724in`, ocho columnas con las proporciones del XLSM y 15 filas por página.
- Baucher: A4 vertical, márgenes verticales `0.75in`, horizontales `0.7in`, Calibri 15 pt y alturas exactas de las siete filas. A solicitud posterior, el ancho se amplió de los `128.6mm` originales a `170mm`, conservando las proporciones de las cuatro columnas y dejando margen dentro del área imprimible A4.
- El PDF no incluye `Atendido`, la fecha auxiliar ni una marca `Página N`, porque están fuera del rango `A1:D7` o pertenecen a la vista de saltos de Excel.
- Prueba temporal de 16 bauchers: dos hojas A4 horizontales; después de bajar `MP-01`, `MP-02` apareció como primer renglón de la hoja.
