import { expect, test } from '@playwright/test'

test('despliega maletas y mueve un baucher a una posición exacta', async ({ page }) => {
  const manifest = { id: 'manifest-1', name: 'Manifiesto de prueba', manifest_date: '2026-09-06', bag_count: 2, voucher_count: 3 }
  const bags = [
    { id: 'bag-1', manifest_id: manifest.id, number: 1, name: 'Maleta #1', attendant: 'Persona uno', voucher_count: 2 },
    { id: 'bag-2', manifest_id: manifest.id, number: 2, name: 'Maleta #2', attendant: 'Persona dos', voucher_count: 1 },
  ]
  const shipment = (id, code, bag, order) => ({
    id,
    code,
    manifest_id: manifest.id,
    bag_id: bag.id,
    bag_number: bag.number,
    print_order: order,
    shipper_name: `Remitente ${code}`,
    shipper_address: 'Ciudad de Guatemala',
    consignee_name: `Destinatario ${code}`,
    consignee_address: 'Dirección de destino',
    phone: '5555-5555',
    contents: 'CLOTHING',
    quantity: 2,
    attendant: bag.attendant,
    shipment_date: manifest.manifest_date,
    status: 'registrado',
    customs_type: 'UNSOLICITED',
  })
  let shipmentsByBag = {
    'bag-1': [shipment('voucher-1', 'A-01', bags[0], 1), shipment('voucher-2', 'A-02', bags[0], 2)],
    'bag-2': [shipment('voucher-3', 'B-01', bags[1], 1)],
  }
  const arrangementPayloads = []

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname.endsWith('/manifests')) return route.fulfill({ json: [manifest] })
    if (request.method() === 'GET' && url.pathname.endsWith('/manifests/manifest-1/bags')) return route.fulfill({ json: bags })
    if (request.method() === 'GET' && url.pathname.endsWith('/bags/bag-1/shipments')) return route.fulfill({ json: shipmentsByBag['bag-1'] })
    if (request.method() === 'GET' && url.pathname.endsWith('/bags/bag-2/shipments')) return route.fulfill({ json: shipmentsByBag['bag-2'] })
    if (request.method() === 'PUT' && url.pathname.endsWith('/manifests/manifest-1/shipments/order')) {
      const arrangementPayload = request.postDataJSON()
      arrangementPayloads.push(arrangementPayload)
      const allShipments = Object.values(shipmentsByBag).flat()
      const next = {}
      for (const bagOrder of arrangementPayload.bags) {
        const targetBag = bags.find((bag) => bag.id === bagOrder.bag_id)
        next[bagOrder.bag_id] = bagOrder.shipment_ids.map((id, index) => ({
          ...allShipments.find((item) => item.id === id),
          bag_id: targetBag.id,
          bag_number: targetBag.number,
          attendant: targetBag.attendant,
          print_order: index + 1,
        }))
      }
      shipmentsByBag = { ...shipmentsByBag, ...next }
      return route.fulfill({ json: next })
    }
    return route.fulfill({ status: 404, json: { detail: `Ruta de prueba no configurada: ${request.method()} ${url.pathname}` } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Maleta #1 / })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Desplegar todas' }).click()
  await expect(page.getByRole('button', { name: /^Maleta #2 / })).toHaveAttribute('aria-expanded', 'true')

  const voucher = page.locator('.voucher-sort-item').filter({ hasText: 'A-01' })
  await voucher.getByRole('button', { name: 'Mover A-01 a otra maleta' }).click()
  await voucher.getByLabel('Maleta de destino').selectOption('bag-2')
  await voucher.getByLabel('Posición en destino').selectOption('0')
  await voucher.getByRole('button', { name: 'Mover baucher' }).click()

  await expect.poll(() => arrangementPayloads[0]).toEqual({
    bags: [
      { bag_id: 'bag-1', shipment_ids: ['voucher-2'] },
      { bag_id: 'bag-2', shipment_ids: ['voucher-1', 'voucher-3'] },
    ],
  })
  const destinationList = page.getByLabel('Orden de bauchers de Maleta #2')
  await expect(destinationList.locator('.voucher-sort-main').first()).toContainText('A-01')
  await expect(page.getByLabel('Maleta', { exact: true })).toHaveValue('bag-2')

  const dragHandle = page.getByRole('button', { name: 'Arrastrar baucher A-02' })
  const targetVoucher = page.locator('.voucher-sort-item').filter({ hasText: 'B-01' })
  const sourceBox = await dragHandle.boundingBox()
  const targetBox = await targetVoucher.boundingBox()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height - 3, { steps: 12 })
  await page.mouse.up()

  await expect.poll(() => arrangementPayloads[1]).toEqual({
    bags: [
      { bag_id: 'bag-1', shipment_ids: [] },
      { bag_id: 'bag-2', shipment_ids: ['voucher-1', 'voucher-3', 'voucher-2'] },
    ],
  })
  await expect(destinationList.locator('.voucher-sort-main').last()).toContainText('A-02')

  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

test('separa las tareas y mantiene las acciones en su contexto', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Manifiestos y maletas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar baucher' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Imprimir todos los bauchers' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar maleta' }).click()
  const bagAttendant = page.getByRole('dialog').getByLabel('Nombre de quien envía *')
  await expect(bagAttendant).not.toHaveValue('')
  const attendantName = await bagAttendant.inputValue()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.locator('.manifest-preview-stack .excel-manifest__attendant').first()).toHaveText(attendantName)

  await page.getByRole('button', { name: 'Agregar maleta' }).first().click()
  await expect(page.getByRole('dialog').getByLabel('Nombre de quien envía *')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Nuevo manifiesto' }).click()
  await expect(page.getByRole('dialog').getByLabel('Nombre de quien envía *')).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Editar manifiesto' }).click()
  await expect(page.getByRole('dialog', { name: 'Editar manifiesto' }).getByLabel('Fecha *')).not.toHaveValue('')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Orden y edición de bauchers' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar maleta' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar maleta' }).click()
  await expect(page.getByRole('dialog').getByLabel('Nombre de quien envía *')).not.toHaveValue('')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Agregar baucher' })).toBeVisible()
  await page.getByRole('button', { name: 'Agregar baucher' }).click()
  const price = page.getByRole('dialog').getByLabel('Precio (USD) *')
  await expect(price).toHaveValue('2')
  await price.fill('7')
  await expect(price).toHaveValue('7')
  await expect(page.getByRole('dialog', { name: 'Agregar baucher' }).getByRole('button', { name: 'Imprimir este baucher' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  const editVoucher = page.locator('.voucher-sort-item').first().getByRole('button', { name: /^Editar / })
  await expect(editVoucher).toBeVisible()
  await editVoucher.click()
  await expect(page.getByRole('dialog', { name: 'Editar baucher' }).getByRole('button', { name: 'Imprimir este baucher' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Eliminar / }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Arrastrar / }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Direcciones', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Direcciones de destino' })).toBeVisible()
})

test('prepara el formulario para agregar otro baucher sin mostrar la dirección asignada', async ({ page }) => {
  await page.route('**/api/v1/shipments', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'baucher-prueba', address_number: 99 }),
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar baucher' }).click()

  const dialog = page.getByRole('dialog', { name: 'Agregar baucher' })
  await dialog.getByLabel('Código del paquete *').fill('PRUEBA-1')
  await dialog.getByLabel('Nombre de quien envía *').fill('Persona remitente')
  await dialog.getByLabel('Nombre de quien recibe *').fill('Persona destinataria')
  await dialog.getByLabel('Dirección en Guatemala *').fill('Ciudad de Guatemala')
  await dialog.getByLabel('Contenido *').fill('ROPA')
  await dialog.getByLabel('Precio (USD) *').fill('7')
  await dialog.getByRole('button', { name: 'Guardar baucher' }).click()

  await expect(dialog).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Baucher guardado' })).toHaveCount(0)
  await expect(dialog.getByLabel('Código del paquete *')).toHaveValue('')
  await expect(dialog.getByLabel('Nombre de quien envía *')).toHaveValue('')
  await expect(dialog.getByLabel('Nombre de quien recibe *')).toHaveValue('')
  await expect(dialog.getByLabel('Dirección en Guatemala *')).toHaveValue('Ciudad de Guatemala')
  await expect(dialog.getByLabel('Contenido *')).toHaveValue('ROPA')
  await expect(dialog.getByLabel('Precio (USD) *')).toHaveValue('7')
  await expect(dialog.getByLabel('Código del paquete *')).toBeFocused()
})

test('guarda e imprime el baucher actual desde el formulario', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1 }
  })
  await page.route('**/api/v1/shipments', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const payload = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...payload,
        id: 'baucher-impreso',
        address_number: 99,
        consignee_address: 'Dirección de impresión',
        phone: '5555-5555',
      }),
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await page.getByRole('button', { name: 'Agregar baucher' }).click()

  const dialog = page.getByRole('dialog', { name: 'Agregar baucher' })
  await dialog.getByLabel('Código del paquete *').fill('PRUEBA-IMPRESION')
  await dialog.getByLabel('Nombre de quien envía *').fill('Persona remitente')
  await dialog.getByLabel('Nombre de quien recibe *').fill('Persona destinataria')
  await dialog.getByLabel('Dirección en Guatemala *').fill('Ciudad de Guatemala')
  await dialog.getByLabel('Contenido *').fill('ROPA')
  await dialog.getByRole('button', { name: 'Imprimir este baucher' }).click()

  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__printCalls || 0)).toBe(1)
  await expect.poll(() => page.locator('body').getAttribute('class')).toContain('print-single-voucher')
  await expect(page.locator('.single-voucher-print-root')).toContainText('PRUEBA-IMPRESION')
})

test('colapsa el sidebar a sus iconos, amplía el contenido y abre los bauchers con doble clic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const sidebar = page.locator('.workspace-sidebar')
  const content = page.locator('.workspace-content')
  const expandedSidebarWidth = await sidebar.evaluate((element) => element.getBoundingClientRect().width)
  const expandedContentWidth = await content.evaluate((element) => element.getBoundingClientRect().width)

  await page.getByRole('button', { name: 'Contraer menú lateral' }).click()
  await expect(page.locator('.workspace-shell')).toHaveClass(/workspace-shell--sidebar-collapsed/)
  await expect(page.getByRole('button', { name: 'Manifiestos y maletas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bauchers', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Direcciones', exact: true })).toBeVisible()
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(90)
  await expect.poll(() => content.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(expandedContentWidth)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440)

  await page.getByRole('button', { name: 'Expandir menú lateral' }).click()
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(expandedSidebarWidth, 0)
  await expect(page.getByRole('button', { name: 'Contraer menú lateral' })).toBeVisible()

  await expect(page.getByText('Doble clic para ampliar').first()).toBeVisible()
  await page.getByRole('button', { name: /Ampliar Maleta/ }).first().dblclick()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').locator('.excel-manifest').first()).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: /Ampliar Maleta/ }).first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.locator('.bag-list > button:not(.bag-list__add)').first().dblclick()
  await expect(page.getByRole('heading', { name: 'Orden y edición de bauchers' })).toBeVisible()
})

test('ajusta la hoja de la maleta al ancho disponible sin desplazamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const previewPage = page.locator('.manifest-preview-page').first()
  const manifest = previewPage.locator('.excel-manifest')
  await expect(manifest).toBeVisible()
  const firstManifestRow = manifest.locator('.excel-manifest__row').first()
  await expect(firstManifestRow.locator('span').nth(6)).toHaveText('UNSOLICITED')
  expect(await firstManifestRow.locator('span').nth(6).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(firstManifestRow.locator('span').nth(7)).toHaveText(/^\$\d+$/)
  await expect.poll(() => previewPage.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await manifest.evaluate((element) => Number.parseFloat(getComputedStyle(element).zoom))).toBeLessThan(1)

  await page.getByRole('button', { name: 'Contraer menú lateral' }).click()
  await expect.poll(() => previewPage.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 375, height: 812 })
  await expect.poll(() => previewPage.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 812, height: 375 })
  await expect.poll(() => previewPage.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

test('busca un baucher por código en todas las maletas del manifiesto', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  const manifestSelect = page.getByLabel('Manifiesto', { exact: true })
  const importedManifestId = await manifestSelect.locator('option').filter({ hasText: 'Manifiesto 2026-08-28' }).getAttribute('value')
  await manifestSelect.selectOption(importedManifestId)

  const search = page.getByLabel('Buscar baucher en este manifiesto')
  await search.fill('010M')
  const result = page.locator('.manifest-voucher-search__results button').filter({ hasText: '010M' }).first()
  await expect(result).toBeVisible()
  await result.click()

  await expect(page.getByLabel('Maleta', { exact: true })).toHaveValue(/.+/)
  await expect(page.locator('.voucher-sort-item--selected')).toContainText('010M')
  await expect(page.locator('.document-stage__canvas--voucher .excel-voucher')).toBeVisible()
})

test('no produce desbordamiento horizontal en móvil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.getByRole('button', { name: 'Contraer menú lateral' }).click()
  await expect(page.getByRole('button', { name: 'Bauchers', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.setViewportSize({ width: 812, height: 375 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})

test('muestra el baucher ancho y aumenta Content para texto largo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await page.locator('.voucher-sort-main').first().click()

  const voucher = page.locator('.document-stage__canvas--voucher .excel-voucher')
  await expect(voucher).toBeVisible()
  expect(await voucher.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(690)

  for (const rowIndex of [2, 4]) {
    const address = voucher.locator('.excel-voucher__row').nth(rowIndex).locator('strong')
    expect(await address.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  }

  const contentRow = voucher.locator('.excel-voucher__content')
  const originalHeight = await contentRow.evaluate((element) => element.getBoundingClientRect().height)
  await contentRow.locator('strong').evaluate((element) => {
    element.textContent = 'CLOTHING, SHOES, TOYS, SCHOOL SUPPLIES, COOKED FOOD AND HOUSEHOLD ITEMS '.repeat(6)
  })
  await expect.poll(() => contentRow.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(originalHeight + 20)
  expect(await contentRow.locator('strong').evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true)
})

test('genera manifiesto completo y todos los bauchers como PDF', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { window.print = () => {} })

  await page.getByRole('button', { name: 'Imprimir manifiesto completo' }).click()
  await expect.poll(() => page.locator('body').getAttribute('class')).toContain('print-manifest-document')
  await page.pdf({ path: '/tmp/maletas-manifest.pdf', landscape: true, preferCSSPageSize: true, printBackground: true })

  await page.evaluate(() => {
    document.body.classList.remove('print-manifest-document')
    document.getElementById('active-print-page')?.remove()
  })
  await page.getByRole('button', { name: 'Imprimir todos los bauchers' }).click()
  await expect.poll(() => page.locator('body').getAttribute('class')).toContain('print-vouchers-document')
  await page.pdf({ path: '/tmp/maletas-vouchers.pdf', preferCSSPageSize: true, printBackground: true })
})
