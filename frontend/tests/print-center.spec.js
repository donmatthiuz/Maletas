import { expect, test } from '@playwright/test'

test('separa las tareas y mantiene las acciones en su contexto', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Manifiestos y maletas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar baucher' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Imprimir todos los bauchers' })).toBeVisible()

  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Orden y edición de bauchers' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar baucher' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Editar / }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Eliminar / }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Arrastrar / }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Direcciones', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Direcciones de destino' })).toBeVisible()
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

test('muestra el baucher ancho sin recortar la dirección', async ({ page }) => {
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
