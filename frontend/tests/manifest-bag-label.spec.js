import { expect, test } from '@playwright/test'

test('edita el texto BAG de un manifiesto y lo muestra en vista previa e impresión', async ({ page }) => {
  let manifest = { id: 'manifest-1', name: 'Manifiesto de prueba', manifest_date: '2026-09-06', bag_count: 1, voucher_count: 1 }
  const bag = { id: 'bag-1', manifest_id: manifest.id, number: 3, name: 'Maleta #3', attendant: 'Persona uno', voucher_count: 1 }
  const shipment = { id: 'voucher-1', code: 'A-01', bag_id: bag.id, bag_number: bag.number, attendant: bag.attendant, shipment_date: manifest.manifest_date }
  let savedLabel = ''

  await page.addInitScript(() => { window.print = () => {} })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'GET' && path.endsWith('/manifests')) return route.fulfill({ json: [manifest] })
    if (request.method() === 'PATCH' && path.endsWith('/manifests/manifest-1')) {
      savedLabel = request.postDataJSON().bag_label
      manifest = { ...manifest, bag_label: savedLabel }
      return route.fulfill({ json: manifest })
    }
    if (request.method() === 'GET' && path.endsWith('/manifests/manifest-1/bags')) return route.fulfill({ json: [bag] })
    if (request.method() === 'GET' && path.endsWith('/bags/bag-1/shipments')) return route.fulfill({ json: [shipment] })
    return route.fulfill({ status: 404, json: { detail: `Ruta no configurada: ${request.method()} ${path}` } })
  })

  await page.goto('/')
  await expect(page.locator('.manifest-preview-stack .excel-manifest__meta')).toContainText('BAG #3')

  await page.getByRole('button', { name: 'Nuevo manifiesto' }).click()
  await expect(page.getByRole('dialog').getByLabel('Texto de la maleta *')).toHaveValue('BAG')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Editar manifiesto' }).click()
  await page.getByRole('dialog').getByLabel('Texto de la maleta *').fill('CAJA')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect.poll(() => savedLabel).toBe('CAJA')
  await expect(page.locator('.manifest-preview-stack .excel-manifest__meta')).toContainText('CAJA #3')

  await page.getByRole('button', { name: 'Ver manifiesto en grande' }).click()
  await expect(page.getByRole('dialog').locator('.excel-manifest__meta')).toContainText('CAJA #3')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()

  await page.getByRole('button', { name: 'Imprimir manifiesto completo' }).click()
  await expect(page.locator('.manifest-print-root .excel-manifest__meta')).toContainText('CAJA #3')
})
