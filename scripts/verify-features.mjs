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

const debugPoint = (page, expression) =>
  page.evaluate((expr) => {
    const debug = window.__osrsDebug
    if (!debug) return null
    const [method, ...args] = expr
    return debug[method](...args)
  }, expression)

const inClearZone = (point) =>
  point && point.x > 80 && point.x < 1000 && point.y > 60 && point.y < 580

const clearPoint = async (page, expression) => {
  for (let i = 0; i < 30; i += 1) {
    const point = await debugPoint(page, expression)
    if (inClearZone(point)) return point
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(120)
  }
  return null
}

const clickDebug = async (page, expression, button = 'left') => {
  const point = await clearPoint(page, expression)
  if (!point) return false
  await page.mouse.click(point.x, point.y, { button })
  return true
}

const menuOption = (page, text) => page.locator('.context-menu-option', { hasText: text }).first()

const rightClickFor = async (page, expression, optionText, attempts = 12) => {
  for (let i = 0; i < attempts; i += 1) {
    const opened = await clickDebug(page, expression, 'right')
    if (opened) {
      await page.waitForTimeout(250)
      const option = menuOption(page, optionText)
      if (await option.isVisible().catch(() => false)) {
        await option.click()
        return true
      }
      const cancel = menuOption(page, 'Cancel')
      if (await cancel.isVisible().catch(() => false)) await cancel.click()
    }
    await page.waitForTimeout(700)
  }
  return false
}

const walkTo = async (page, x, z, settleMs = 4000) => {
  const clicked = await clickDebug(page, ['tile', x, z])
  await page.waitForTimeout(settleMs)
  const self = await debugPoint(page, ['self'])
  console.log(`  walkTo(${x},${z}) clicked=${clicked} now at ${JSON.stringify(self)}`)
}

const chatIncludes = async (page, text) =>
  (await page.locator('.chat-log').innerText()).includes(text)

const waitForChat = async (page, text, timeoutMs) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await chatIncludes(page, text)) return true
    await page.waitForTimeout(800)
  }
  return false
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()
page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`))
await page.goto(BASE)
await page.getByLabel('Display name').fill('Tester')
await page.getByRole('button', { name: 'Play' }).click()
await page.waitForSelector('.scene-container canvas')
await page.waitForTimeout(2000)

check(
  'examine a ground item writes to the chatbox',
  (await rightClickFor(page, ['groundItem', 30, 30, 'coins'], 'Examine Coins')) &&
    (await waitForChat(page, 'Lovely money!', 3000)),
)

check(
  'take bronze sword via right-click menu',
  await rightClickFor(page, ['groundItem', 34, 30, 'bronze_sword'], 'Take Bronze sword'),
)
await page.waitForTimeout(4000)
const swordSlot = page.getByLabel('Bronze sword x1')
check('bronze sword appears in inventory', await swordSlot.isVisible().catch(() => false))

await swordSlot.click()
await page.waitForTimeout(1500)
await page.getByRole('tab', { name: 'Equipment' }).click()
check(
  'left-click wields the sword into the weapon slot',
  await page
    .getByLabel('Unequip Bronze sword')
    .isVisible()
    .catch(() => false),
)
await page.screenshot({ path: `${SHOTS}/05-equipped.png` })
await page.getByRole('tab', { name: 'Inventory' }).click()

check(
  'take bronze axe',
  await rightClickFor(page, ['groundItem', 30, 34, 'bronze_axe'], 'Take Bronze axe'),
)
await page.waitForTimeout(4000)

check(
  'talk to the guide opens dialogue',
  await rightClickFor(page, ['entity', 'npc_guide'], 'Talk-to Lumbridge Guide'),
)
const dialogueAppeared = await page
  .locator('.dialogue-box')
  .waitFor({ timeout: 8000 })
  .then(() => true)
  .catch(() => false)
check('dialogue box shows guide lines', dialogueAppeared)
await page.screenshot({ path: `${SHOTS}/06-dialogue.png` })
if (dialogueAppeared) {
  for (let i = 0; i < 6; i += 1) {
    if (
      !(await page
        .locator('.dialogue-box')
        .isVisible()
        .catch(() => false))
    )
      break
    await page.locator('.dialogue-box').click()
    await page.waitForTimeout(200)
  }
}

await walkTo(page, 25, 38, 6000)
check('chop down a tree', await rightClickFor(page, ['tree', 'tree_7'], 'Chop down Tree'))
check('woodcutting grants logs', await waitForChat(page, 'You get some logs.', 20000))
await page.getByRole('tab', { name: 'Skills' }).click()
await page.screenshot({ path: `${SHOTS}/07-skills.png` })
await page.getByRole('tab', { name: 'Inventory' }).click()

await walkTo(page, 20, 44, 8000)
await walkTo(page, 14, 47, 8000)
let attacked = false
for (const goblin of ['npc_goblin_0', 'npc_goblin_1', 'npc_goblin_2']) {
  if (await rightClickFor(page, ['entity', goblin], 'Attack Goblin', 3)) {
    attacked = true
    break
  }
}
check('attack a goblin via right-click', attacked)
check('combat kills the goblin', await waitForChat(page, 'You have defeated the Goblin.', 60000))
await page.screenshot({ path: `${SHOTS}/08-combat.png` })

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length === 0 ? 0 : 1)
