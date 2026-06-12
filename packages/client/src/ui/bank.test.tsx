import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import type { ClientMessage, ItemStack } from '@osrs/shared'
import { BankPanel } from './BankPanel'

const inventoryWith = (stacks: readonly (ItemStack | null)[]): (ItemStack | null)[] => [
  ...stacks,
  ...Array.from({ length: 28 - stacks.length }, () => null),
]

describe('BankPanel', () => {
  it('lists banked stacks with quantities', async () => {
    render(
      <BankPanel
        bank={[
          { itemId: 'coins', quantity: 1000 },
          { itemId: 'raw_shrimps', quantity: 12 },
        ]}
        inventory={inventoryWith([])}
        onSend={() => {}}
        onClose={() => {}}
      />,
    )
    await expect.element(page.getByText('Bank of Gielinor')).toBeVisible()
    await expect.element(page.getByLabelText('Withdraw Coins x1000')).toBeVisible()
    await expect.element(page.getByLabelText('Withdraw Raw shrimps x12')).toBeVisible()
  })

  it('withdraws one on click and everything on right-click', async () => {
    const onSend = vi.fn<(message: ClientMessage) => void>()
    render(
      <BankPanel
        bank={[{ itemId: 'coins', quantity: 1000 }]}
        inventory={inventoryWith([])}
        onSend={onSend}
        onClose={() => {}}
      />,
    )
    await page.getByLabelText('Withdraw Coins x1000').click()
    expect(onSend).toHaveBeenCalledWith({ type: 'withdrawItem', bankIndex: 0, amount: 1 })
    await page.getByLabelText('Withdraw Coins x1000').click({ button: 'right' })
    expect(onSend).toHaveBeenLastCalledWith({ type: 'withdrawItem', bankIndex: 0, amount: 'all' })
  })

  it('deposits from the inventory strip', async () => {
    const onSend = vi.fn<(message: ClientMessage) => void>()
    render(
      <BankPanel
        bank={[]}
        inventory={inventoryWith([{ itemId: 'logs', quantity: 1 }])}
        onSend={onSend}
        onClose={() => {}}
      />,
    )
    await page.getByLabelText('Deposit Logs x1').click()
    expect(onSend).toHaveBeenCalledWith({ type: 'depositItem', slot: 0, amount: 1 })
    await page.getByLabelText('Deposit Logs x1').click({ button: 'right' })
    expect(onSend).toHaveBeenLastCalledWith({ type: 'depositItem', slot: 0, amount: 'all' })
  })

  it('closes via the close button', async () => {
    const onClose = vi.fn()
    render(
      <BankPanel bank={[]} inventory={inventoryWith([])} onSend={() => {}} onClose={onClose} />,
    )
    await page.getByRole('button', { name: 'Close' }).click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
