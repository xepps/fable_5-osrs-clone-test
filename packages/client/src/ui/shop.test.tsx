import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import type { ClientMessage, ItemStack } from '@osrs/shared'
import { ShopPanel } from './ShopPanel'

const inventoryWith = (stacks: readonly (ItemStack | null)[]): (ItemStack | null)[] => [
  ...stacks,
  ...Array.from({ length: 28 - stacks.length }, () => null),
]

describe('ShopPanel', () => {
  it('lists the stock with prices', async () => {
    render(
      <ShopPanel
        shop={[
          { itemId: 'small_fishing_net', quantity: 5 },
          { itemId: 'bronze_axe', quantity: 0 },
        ]}
        inventory={inventoryWith([])}
        onSend={() => {}}
        onClose={() => {}}
      />,
    )
    await expect.element(page.getByText('General Store')).toBeVisible()
    await expect
      .element(page.getByLabelText('Buy Small fishing net for 5 coins (5 in stock)'))
      .toBeVisible()
    await expect
      .element(page.getByLabelText('Buy Bronze axe for 16 coins (0 in stock)'))
      .toBeVisible()
  })

  it('buys one on click', async () => {
    const onSend = vi.fn<(message: ClientMessage) => void>()
    render(
      <ShopPanel
        shop={[{ itemId: 'small_fishing_net', quantity: 5 }]}
        inventory={inventoryWith([])}
        onSend={onSend}
        onClose={() => {}}
      />,
    )
    await page.getByLabelText('Buy Small fishing net for 5 coins (5 in stock)').click()
    expect(onSend).toHaveBeenCalledWith({
      type: 'buyItem',
      itemId: 'small_fishing_net',
      amount: 1,
    })
  })

  it('sells from the inventory strip', async () => {
    const onSend = vi.fn<(message: ClientMessage) => void>()
    render(
      <ShopPanel
        shop={[]}
        inventory={inventoryWith([{ itemId: 'logs', quantity: 1 }])}
        onSend={onSend}
        onClose={() => {}}
      />,
    )
    await page.getByLabelText('Sell Logs for 1 coins').click()
    expect(onSend).toHaveBeenCalledWith({ type: 'sellItem', slot: 0, amount: 1 })
  })

  it('closes via the close button', async () => {
    const onClose = vi.fn()
    render(
      <ShopPanel shop={[]} inventory={inventoryWith([])} onSend={() => {}} onClose={onClose} />,
    )
    await page.getByRole('button', { name: 'Close' }).click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
