import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import type { SnapshotMessage } from '@osrs/shared'
import { MINIMAP_SIZE, PX_PER_TILE } from '../game/minimap'
import { Minimap } from './Minimap'
import { RunOrb } from './RunOrb'

const snapshotWith = (overrides: Partial<SnapshotMessage> = {}): SnapshotMessage => ({
  type: 'snapshot',
  tick: 1,
  save: 'blob==',
  players: [
    {
      id: 'p1',
      name: 'Bob',
      x: 96,
      z: 96,
      facing: { dx: 0, dz: 1 },
      hp: 10,
      maxHp: 10,
      overheadText: null,
      equipment: { head: null, weapon: null },
    },
  ],
  npcs: [],
  groundItems: [],
  depletedObjects: [],
  events: [],
  you: {
    hp: 10,
    inventory: Array.from({ length: 28 }, () => null),
    equipment: { head: null, weapon: null },
    skills: {
      attack: 0,
      strength: 0,
      defence: 0,
      hitpoints: 1154,
      woodcutting: 0,
      fishing: 0,
      cooking: 0,
    },
    runEnergy: 100,
    runEnabled: false,
    openInterface: null,
    bank: null,
    shop: null,
  },
  ...overrides,
})

describe('RunOrb', () => {
  it('shows the current run energy and whether running is active', async () => {
    render(<RunOrb runEnergy={73} runEnabled={false} onToggle={() => {}} />)
    const orb = page.getByRole('button', { name: /run/i })
    await expect.element(orb).toHaveTextContent('73')
    await expect.element(orb).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects an enabled run mode', async () => {
    render(<RunOrb runEnergy={40} runEnabled={true} onToggle={() => {}} />)
    await expect
      .element(page.getByRole('button', { name: /run/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('invokes the toggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<RunOrb runEnergy={100} runEnabled={false} onToggle={onToggle} />)
    await page.getByRole('button', { name: /run/i }).click()
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe('Minimap', () => {
  it('walks to the tile under a click, projected around the player', async () => {
    const onWalkTo = vi.fn()
    render(<Minimap snapshot={snapshotWith()} selfId="p1" onWalkTo={onWalkTo} />)
    const map = page.getByRole('img', { name: 'Minimap' })
    await map.click({ position: { x: MINIMAP_SIZE / 2, y: MINIMAP_SIZE / 2 } })
    expect(onWalkTo).toHaveBeenCalledWith(96, 96)
    await map.click({
      position: { x: MINIMAP_SIZE / 2 + 4 * PX_PER_TILE, y: MINIMAP_SIZE / 2 - 3 * PX_PER_TILE },
    })
    expect(onWalkTo).toHaveBeenLastCalledWith(100, 93)
  })
})
