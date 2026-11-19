import { expect, test } from '@playwright/test'

test('avisa duplicados y completa las sugerencias al crear una dirección', async ({ page }) => {
  const existing = {
    id: 'address-1', number: 99,
    address: 'Calle San José 12', phone: '(240) 556-3504',
  }
  let saved = null

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'GET' && url.pathname.endsWith('/manifests')) return route.fulfill({ json: [] })
    if (request.method() === 'GET' && url.pathname.endsWith('/addresses')) return route.fulfill({ json: [existing] })
    if (request.method() === 'POST' && url.pathname.endsWith('/addresses/check')) {
      const form = request.postDataJSON()
      const normalizedAddress = (form.address || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
      const normalizedPhone = (form.phone || '').replace(/\D/g, '')
      return route.fulfill({ json: {
        duplicate_number: form.number === 99,
        duplicate_phone: normalizedPhone === '2405563504',
        duplicate_address: normalizedAddress === 'calle san jose 12',
        suggested_number: 100,
        suggested_phone: '2405563505',
      } })
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/addresses')) {
      saved = request.postDataJSON()
      return route.fulfill({ status: 201, json: { id: 'address-2', ...saved } })
    }
    return route.fulfill({ status: 404, json: { detail: 'Ruta no configurada' } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Direcciones', exact: true }).click()
  await page.getByRole('button', { name: 'Nueva dirección' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nueva dirección' })
  await dialog.getByLabel('Número *').fill('99')
  await dialog.getByLabel('Teléfono *').fill('240.556.3504')
  await dialog.getByLabel('Dirección completa *').fill('CALLE SAN JOSE 12')
  await expect(dialog.getByText('Este número ya existe.')).toBeVisible()
  await expect(dialog.getByText('Este teléfono ya existe, aunque tenga otro formato.')).toBeVisible()
  await expect(dialog.getByText('Esta dirección ya existe, aunque cambien mayúsculas o tildes.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Guardar dirección' })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Usar siguiente número: 100' }).click()
  await dialog.getByRole('button', { name: 'Usar teléfono sugerido: 2405563505' }).click()
  await expect(dialog.getByLabel('Número *')).toHaveValue('100')
  await expect(dialog.getByLabel('Teléfono *')).toHaveValue('2405563505')
  await expect(dialog.getByText('Esta dirección ya existe, aunque cambien mayúsculas o tildes.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Guardar dirección' })).toBeDisabled()

  await dialog.getByLabel('Dirección completa *').fill('Calle nueva 13')
  await expect(dialog.getByRole('button', { name: 'Guardar dirección' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Guardar dirección' }).click()
  await expect.poll(() => saved).toMatchObject({ number: 100, phone: '2405563505', address: 'Calle nueva 13' })
})
