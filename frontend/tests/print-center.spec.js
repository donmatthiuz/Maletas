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

test('no produce desbordamiento horizontal en móvil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.getByRole('button', { name: 'Bauchers', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  await page.setViewportSize({ width: 812, height: 375 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
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
