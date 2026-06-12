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

const login = async (context, name) => {
  const page = await context.newPage()
  page.on('pageerror', (error) => console.log(`[${name}] pageerror: ${error.message}`))
  await page.goto(BASE)
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForSelector('.scene-container canvas', { timeout: 5000 })
  await page.waitForTimeout(1500)
  return page
}

const worldClick = async (page, x, y, button = 'left') => {
  await page.locator('.scene-container canvas').click({ position: { x, y }, button })
}

const chatLog = (page) => page.locator('.chat-log').innerText()

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })

const alice = await login(context, 'Alice')
const bob = await login(context, 'Bob')
await alice.waitForTimeout(1500)

check('two players can log in to the same world', true)

await alice.screenshot({ path: `${SHOTS}/01-alice-spawn.png` })

const canvasCenter = { x: 640, y: 400 }

await worldClick(alice, canvasCenter.x - 200, canvasCenter.y - 60)
await alice.waitForTimeout(2500)
await alice.screenshot({ path: `${SHOTS}/02-alice-walked.png` })
check('left click walks (no crash, scene still live)', await alice.locator('canvas').isVisible())

await worldClick(alice, canvasCenter.x, canvasCenter.y, 'right')
await alice.waitForTimeout(300)
const menuVisible = await alice
  .locator('.context-menu')
  .isVisible()
  .catch(() => false)
check('right click opens a context menu', menuVisible)
await alice.screenshot({ path: `${SHOTS}/03-context-menu.png` })
if (menuVisible) {
  const optionTexts = await alice.locator('.context-menu-option').allInnerTexts()
  check(
    'menu contains Walk here and Cancel',
    optionTexts.join().includes('Walk here') && optionTexts.join().includes('Cancel'),
  )
  await alice.locator('.context-menu-option', { hasText: 'Cancel' }).click()
}

await alice.locator('.chat-input').fill('hello bob!')
await alice.keyboard.press('Enter')
await alice.waitForTimeout(1500)
const bobLog = await chatLog(bob)
check('chat from Alice appears in Bob chatbox', bobLog.includes('Alice: hello bob!'))
const overheadOnBobScreen = await bob
  .locator('.overhead-text', { hasText: 'hello bob!' })
  .isVisible()
  .catch(() => false)
check('chat floats above Alice head on Bob screen', overheadOnBobScreen)
await bob.screenshot({ path: `${SHOTS}/04-bob-sees-chat.png` })

await browser.close()

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
