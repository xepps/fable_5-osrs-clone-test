import { chromium } from 'playwright'
import { existsSync, mkdirSync, renameSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const SHOTS = 'scripts/shots'
const ASSETS_DIR = 'packages/client/public/osrs-assets'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (label, condition) => {
  results.push({ label, ok: Boolean(condition) })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

const login = async (name) => {
  await page.goto(BASE)
  await page.waitForTimeout(600)
  const playButton = page.getByRole('button', { name: `Play ${name}` })
  if (await playButton.count()) {
    await playButton.click()
  } else {
    await page.getByLabel('Display name').fill(name)
    await page.getByRole('button', { name: 'Create' }).click()
  }
  await page.waitForSelector('.scene-container canvas', { timeout: 8000 })
  await page.waitForTimeout(2500)
}

const self = () => page.evaluate(() => window.__osrsDebug.self())
const tile = (x, z) => page.evaluate(([tx, tz]) => window.__osrsDebug.tile(tx, tz), [x, z])
const entityOnScreen = (id) => page.evaluate((eid) => window.__osrsDebug.entity(eid), id)

const onScreen = (point) => point && point.x > 20 && point.x < 1260 && point.y > 20 && point.y < 780

// 3D tile projections depend on where the camera faces; the minimap does not, so
// navigate with minimap clicks (centre = player, 4px per tile, ~19 tile radius).
const minimapWalk = async (dx, dz) => {
  await page
    .getByRole('img', { name: 'Minimap' })
    .click({ position: { x: 76 + dx * 4, y: 76 + dz * 4 } })
}

const walkTo = async (targetX, targetZ) => {
  for (let hop = 0; hop < 16; hop += 1) {
    const me = await self()
    if (!me) return false
    const dx = targetX - me.x
    const dz = targetZ - me.z
    if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) return true
    const step = (value) => Math.max(-15, Math.min(15, value))
    await minimapWalk(step(dx), step(dz))
    await page.waitForTimeout(2800)
  }
  const me = await self()
  return me && Math.abs(targetX - me.x) <= 2 && Math.abs(targetZ - me.z) <= 2
}

const rotateUntilVisible = async (x, z) => {
  for (let i = 0; i < 24; i += 1) {
    const point = await tile(x, z)
    if (onScreen(point)) return point
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(120)
  }
  return null
}

const RUN_NAME = `Vm${String(Date.now()).slice(-6)}`
await login(RUN_NAME)
check('logged in with assets present', true)
await page.screenshot({ path: `${SHOTS}/m-10-spawn.png` })

await page.getByRole('button', { name: 'Toggle run' }).click()
await page.waitForTimeout(1200)
const beforeRun = await self()
await minimapWalk(-12, 0)
await page.waitForTimeout(1200)
await page.screenshot({ path: `${SHOTS}/m-11-running.png` })
await page.waitForTimeout(3000)
check('ran west', (await self()).x < beforeRun.x - 6)

check('guide entity rendered', Boolean(await entityOnScreen('npc_guide')))

await walkTo(81, 109)
check('walked to the goblin camp', Boolean(await self()))
const goblinVisible = await entityOnScreen('npc_goblin_0')
check('goblin entity rendered near camp', Boolean(goblinVisible))
if (goblinVisible && onScreen(goblinVisible)) {
  await page.mouse.click(goblinVisible.x, goblinVisible.y)
  await page.waitForTimeout(2400)
  await page.screenshot({ path: `${SHOTS}/m-12-goblin-fight.png` })
  check('attacked the goblin (no page errors)', pageErrors.length === 0)
  await minimapWalk(0, -8)
  await page.waitForTimeout(2600)
}

await walkTo(85, 86)
const treePoint = await rotateUntilVisible(84, 84)
check('tree visible on screen', Boolean(treePoint))
await page.screenshot({ path: `${SHOTS}/m-13-tree.png` })

await walkTo(107, 76)
const spotPoint = await rotateUntilVisible(108, 75)
check('fishing spot visible after walking to the pond', Boolean(spotPoint))
if (spotPoint) {
  const clipRegion = {
    x: Math.max(0, spotPoint.x - 100),
    y: Math.max(0, spotPoint.y - 100),
    width: 200,
    height: 200,
  }
  const frameA = await page.screenshot({ clip: clipRegion })
  await page.waitForTimeout(500)
  const frameB = await page.screenshot({ clip: clipRegion })
  check('fishing spot region animates between frames', !frameA.equals(frameB))
}
await page.screenshot({ path: `${SHOTS}/m-14-fishing-spot.png` })

check('no page errors with assets', pageErrors.length === 0)

await page.close()
await new Promise((resolve) => setTimeout(resolve, 1500))
renameSync(ASSETS_DIR, `${ASSETS_DIR}-disabled`)
try {
  const fallbackErrors = []
  const fallbackPage = await context.newPage()
  fallbackPage.on('pageerror', (error) => fallbackErrors.push(error.message))
  await fallbackPage.goto(BASE)
  await fallbackPage.waitForTimeout(600)
  await fallbackPage.getByRole('button', { name: `Play ${RUN_NAME}` }).click()
  await fallbackPage.waitForSelector('.scene-container canvas', { timeout: 8000 })
  await fallbackPage.waitForTimeout(2500)
  await fallbackPage.screenshot({ path: `${SHOTS}/m-15-fallback.png` })
  check('procedural fallback renders without assets', fallbackErrors.length === 0)
  await fallbackPage.close()
} finally {
  renameSync(`${ASSETS_DIR}-disabled`, ASSETS_DIR)
}
check('assets directory restored', existsSync(`${ASSETS_DIR}/manifest.json`))

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
