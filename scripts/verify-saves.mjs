import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const SHOTS = 'scripts/shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (label, condition) => {
  results.push({ label, ok: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`))

await page.goto(BASE)
await page.getByLabel('Display name').fill('Saver')
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('.scene-container canvas', { timeout: 5000 })
await page.waitForTimeout(2500)
check('a new character enters the world', true)
await page.screenshot({ path: `${SHOTS}/s-01-fresh.png` })

const coinsPoint = await page.evaluate(() => window.__osrsDebug.groundItem(94, 94, 'coins'))
await page.mouse.click(coinsPoint.x, coinsPoint.y)
await page.waitForTimeout(4500)
check('picked up the coin spawn', (await page.getByLabel(/Coins x25/).count()) > 0)

const blobBefore = await page.evaluate(() => {
  const index = JSON.parse(localStorage.getItem('osrs.characters'))
  return localStorage.getItem(`osrs.save.${index[0].id}`)
})
check(
  'an encrypted save blob landed in localStorage',
  Boolean(blobBefore) && blobBefore.length > 50,
)
check('the blob is not readable JSON', !blobBefore.includes('inventory'))

await page.reload()
await page.waitForTimeout(800)
check('the home screen lists the character after reload', await page.getByText('Saver').isVisible())
await page.screenshot({ path: `${SHOTS}/s-02-home.png` })

await page.getByRole('button', { name: 'Play Saver' }).click()
await page.waitForSelector('.scene-container canvas', { timeout: 5000 })
await page.waitForTimeout(2500)
check(
  'the restored character still has the coins',
  (await page.getByLabel(/Coins x25/).count()) > 0,
)
await page.screenshot({ path: `${SHOTS}/s-03-restored.png` })

const positionAfter = await page.evaluate(() => window.__osrsDebug.self())
check(
  'the restored character is at the coin tile, not spawn',
  positionAfter && Math.abs(positionAfter.x - 94) <= 1 && Math.abs(positionAfter.z - 94) <= 1,
)

await page.evaluate(() => {
  const index = JSON.parse(localStorage.getItem('osrs.characters'))
  const key = `osrs.save.${index[0].id}`
  const blob = localStorage.getItem(key)
  const corrupted = (blob[10] === 'A' ? 'B' : 'A') + blob.slice(1)
  localStorage.setItem(key, blob.slice(0, 10) + corrupted[0] + blob.slice(11))
})
await page.reload()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Play Saver' }).click()
await page.waitForTimeout(2000)
check('a tampered save is rejected with an error', await page.getByRole('alert').isVisible())
await page.screenshot({ path: `${SHOTS}/s-04-tampered.png` })

await page.getByLabel('Display name').fill('Fresh')
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('.scene-container canvas', { timeout: 5000 })
await page.waitForTimeout(1500)
check('creating a new character still works after a rejection', true)

const second = await context.newPage()
await second.goto(BASE)
await second.waitForTimeout(800)
await second.getByRole('button', { name: 'Play Fresh' }).click()
await second.waitForTimeout(2000)
check('the same character cannot log in twice', await second.getByRole('alert').isVisible())
await second.screenshot({ path: `${SHOTS}/s-05-duplicate.png` })

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
