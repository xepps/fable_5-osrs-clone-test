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
await page.getByLabel('Display name').fill('Tester')
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('.scene-container canvas', { timeout: 5000 })
await page.waitForTimeout(2000)
await page.screenshot({ path: `${SHOTS}/p2-01-spawn.png` })

const self = () => page.evaluate(() => window.__osrsDebug.self())
const tile = (x, z) => page.evaluate(([tx, tz]) => window.__osrsDebug.tile(tx, tz), [x, z])
const clickTile = async (x, z, settle = 3000) => {
  const point = await tile(x, z)
  if (!point) return false
  await page.mouse.click(point.x, point.y)
  await page.waitForTimeout(settle)
  return true
}

const spawn = await self()
check(
  'player spawns in the centre chunk near (96,96)',
  spawn && Math.abs(spawn.x - 96) <= 2 && Math.abs(spawn.z - 96) <= 2,
)

check('minimap is visible', await page.getByRole('img', { name: 'Minimap' }).isVisible())
const runOrb = page.getByRole('button', { name: 'Toggle run' })
check(
  'run orb is visible with 100 energy',
  (await page.locator('.run-orb-energy').textContent()) === '100',
)

await runOrb.click()
await page.waitForTimeout(1400)
check('run orb toggles on', (await runOrb.getAttribute('aria-pressed')) === 'true')

await page.getByRole('img', { name: 'Minimap' }).click({ position: { x: 76, y: 30 } })
await page.waitForTimeout(4500)
const afterRun = await self()
const energyAfterRun = Number(await page.locator('.run-orb-energy').textContent())
check('minimap click walks the player north', afterRun && afterRun.z < spawn.z - 4)
check('running drained energy', energyAfterRun < 100)
await page.screenshot({ path: `${SHOTS}/p2-02-after-run-north.png` })

await page.waitForTimeout(4000)
const energyLater = Number(await page.locator('.run-orb-energy').textContent())
check('energy restores while idle', energyLater > energyAfterRun)

await runOrb.click()
await page.waitForTimeout(300)

await clickTile(101, 93, 5000)
await clickTile(101, 90, 5000)
const inBank = await self()
check(
  'player can walk through the bank doorway',
  inBank && inBank.z <= 91 && inBank.x >= 99 && inBank.x <= 104,
)
await page.screenshot({ path: `${SHOTS}/p2-03-inside-bank.png` })

const boothPoint = await tile(100, 88)
await page.mouse.click(boothPoint.x, boothPoint.y, { button: 'right' })
await page.waitForTimeout(500)
await page.screenshot({ path: `${SHOTS}/p2-04-booth-menu.png` })
const bankOption = page.getByRole('menuitem', { name: /Bank/ })
const hasBankOption = await bankOption.count()
check('bank booth offers a Bank option', hasBankOption > 0)
if (hasBankOption > 0) {
  await bankOption.first().click()
  await page.waitForTimeout(2500)
  check('bank panel opens', await page.getByText('Bank of Gielinor').isVisible())
  await page.screenshot({ path: `${SHOTS}/p2-05-bank-open.png` })
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(800)
}

await clickTile(101, 93, 4000)
await clickTile(96, 96, 5000)
const coinsPoint = await page.evaluate(() => window.__osrsDebug.groundItem(94, 94, 'coins'))
if (coinsPoint) {
  await page.mouse.click(coinsPoint.x, coinsPoint.y)
  await page.waitForTimeout(4000)
}
check('picked up the coin spawn', (await page.getByLabel(/Coins x25/).count()) > 0)
await clickTile(93, 101, 5000)
const shopkeeperEntity = await page.evaluate(() => window.__osrsDebug.entity('npc_shopkeeper'))
if (shopkeeperEntity) {
  await page.mouse.click(shopkeeperEntity.x, shopkeeperEntity.y, { button: 'right' })
  await page.waitForTimeout(500)
  const trade = page.getByRole('menuitem', { name: /Trade/ })
  check('shopkeeper offers Trade', (await trade.count()) > 0)
  if ((await trade.count()) > 0) {
    await trade.first().click()
    await page.waitForTimeout(3500)
    check('shop panel opens', await page.getByText('General Store').isVisible())
    await page.screenshot({ path: `${SHOTS}/p2-06-shop-open.png` })
    const netButton = page.getByLabel(/Buy Small fishing net/)
    if ((await netButton.count()) > 0) {
      await netButton.click()
      await page.waitForTimeout(1200)
      check('bought a fishing net', (await page.getByLabel(/Sell Small fishing net/).count()) > 0)
    }
    await page.getByRole('button', { name: 'Close' }).click()
  }
} else {
  check('shopkeeper visible in scene', false)
}
await page.screenshot({ path: `${SHOTS}/p2-07-final.png` })

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
