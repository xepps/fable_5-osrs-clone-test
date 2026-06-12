import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from '@vitest/browser/context'
import type { PrivateState } from '@osrs/shared'
import { NamePrompt } from './NamePrompt'
import { ContextMenu } from './ContextMenu'
import { ChatPanel } from './ChatPanel'
import { DialogueBox } from './DialogueBox'
import { SidePanel } from './SidePanel'

const youWith = (overrides: Partial<PrivateState> = {}): PrivateState => ({
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
  ...overrides,
})

describe('NamePrompt', () => {
  it('submits a trimmed display name', async () => {
    const onSubmit = vi.fn()
    render(<NamePrompt onSubmit={onSubmit} />)
    await userEvent.fill(page.getByLabelText('Display name'), '  Zezima ')
    await page.getByRole('button', { name: 'Play' }).click()
    expect(onSubmit).toHaveBeenCalledWith('Zezima')
  })

  it('refuses to submit an empty name', async () => {
    const onSubmit = vi.fn()
    render(<NamePrompt onSubmit={onSubmit} />)
    await expect.element(page.getByRole('button', { name: 'Play' })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('ContextMenu', () => {
  it('shows the options in order and reports the chosen one', async () => {
    const onSelect = vi.fn()
    render(
      <ContextMenu
        menu={{
          screenX: 10,
          screenY: 10,
          options: [
            { label: 'Take', targetName: 'Bronze sword', action: { type: 'cancel' } },
            { label: 'Walk here', action: { type: 'cancel' } },
            { label: 'Cancel', action: { type: 'cancel' } },
          ],
        }}
        onSelect={onSelect}
      />,
    )
    await expect.element(page.getByText('Choose Option')).toBeVisible()
    await page.getByRole('menuitem', { name: 'Take Bronze sword' }).click()
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Take', targetName: 'Bronze sword' }),
    )
  })
})

describe('ChatPanel', () => {
  it('shows the chat log and sends a typed message on enter', async () => {
    const onSend = vi.fn()
    render(
      <ChatPanel
        lines={[
          { kind: 'chat', text: 'Alice: hello' },
          { kind: 'system', text: 'You get some logs.' },
        ]}
        onSend={onSend}
      />,
    )
    await expect.element(page.getByText('Alice: hello')).toBeVisible()
    await expect.element(page.getByText('You get some logs.')).toBeVisible()
    await userEvent.fill(page.getByLabelText('Chat message'), 'hi everyone')
    await userEvent.keyboard('{Enter}')
    expect(onSend).toHaveBeenCalledWith('hi everyone')
  })
})

describe('DialogueBox', () => {
  it('shows the current line and advances on click', async () => {
    const onAdvance = vi.fn()
    render(
      <DialogueBox
        dialogue={{ npcName: 'Lumbridge Guide', lines: ['Hello!', 'Bye!'], index: 0 }}
        onAdvance={onAdvance}
      />,
    )
    await expect.element(page.getByText('Hello!')).toBeVisible()
    await page.getByText('Click here to continue').click()
    expect(onAdvance).toHaveBeenCalled()
  })
})

describe('SidePanel inventory', () => {
  it('renders all 28 slots', async () => {
    render(<SidePanel you={youWith()} onAction={() => {}} onOpenMenu={() => {}} />)
    await expect.element(page.getByLabelText('Empty slot 1', { exact: true })).toBeInTheDocument()
    await expect.element(page.getByLabelText('Empty slot 28')).toBeInTheDocument()
  })

  it('left-click on a sword wields it (the primary option)', async () => {
    const onAction = vi.fn()
    const you = youWith({
      inventory: [
        { itemId: 'bronze_sword', quantity: 1 },
        ...Array.from({ length: 27 }, () => null),
      ],
    })
    render(<SidePanel you={you} onAction={onAction} onOpenMenu={() => {}} />)
    await page.getByLabelText('Bronze sword x1').click()
    expect(onAction).toHaveBeenCalledWith({
      type: 'send',
      message: { type: 'equipItem', slot: 0 },
    })
  })

  it('right-click on an item opens its menu', async () => {
    const onOpenMenu = vi.fn()
    const you = youWith({
      inventory: [{ itemId: 'logs', quantity: 1 }, ...Array.from({ length: 27 }, () => null)],
    })
    render(<SidePanel you={you} onAction={() => {}} onOpenMenu={onOpenMenu} />)
    await page.getByLabelText('Logs x1').click({ button: 'right' })
    expect(onOpenMenu).toHaveBeenCalled()
    const options = onOpenMenu.mock.calls[0]?.[2]
    expect(options.map((option: { label: string }) => option.label)).toEqual([
      'Use',
      'Drop',
      'Examine',
      'Cancel',
    ])
  })

  it('shows equipment and unequips on click', async () => {
    const onAction = vi.fn()
    const you = youWith({
      equipment: { head: { itemId: 'bronze_med_helm', quantity: 1 }, weapon: null },
    })
    render(<SidePanel you={you} onAction={onAction} onOpenMenu={() => {}} />)
    await page.getByRole('tab', { name: 'Equipment' }).click()
    await page.getByLabelText('Unequip Bronze med helm').click()
    expect(onAction).toHaveBeenCalledWith({
      type: 'send',
      message: { type: 'unequipItem', equipSlot: 'head' },
    })
  })

  it('shows skill levels derived from xp', async () => {
    const you = youWith({
      skills: {
        attack: 83,
        strength: 0,
        defence: 0,
        hitpoints: 1154,
        woodcutting: 0,
        fishing: 0,
        cooking: 0,
      },
    })
    render(<SidePanel you={you} onAction={() => {}} onOpenMenu={() => {}} />)
    await page.getByRole('tab', { name: 'Skills' }).click()
    const attackRow = page.getByText('Attack')
    await expect.element(attackRow).toBeVisible()
    await expect.element(page.getByText('Hitpoints')).toBeVisible()
  })
})
