import { describe, expect, it } from 'vitest'
import { buyPrice, sellPrice, SHOP_BASE_STOCK } from './shop'

describe('shop prices', () => {
  it('buys at the item value', () => {
    expect(buyPrice('small_fishing_net')).toBe(5)
    expect(buyPrice('bronze_sword')).toBe(26)
  })

  it('sells back at 40% of the value, rounded down', () => {
    expect(sellPrice('bronze_sword')).toBe(10)
    expect(sellPrice('logs')).toBe(1)
  })

  it('never sells an item back for more than it costs to buy', () => {
    Object.keys(SHOP_BASE_STOCK).forEach((itemId) => {
      const id = itemId as keyof typeof SHOP_BASE_STOCK
      expect(sellPrice(id)).toBeLessThanOrEqual(buyPrice(id))
    })
  })
})

describe('shop stock', () => {
  it('stocks fishing nets and bronze axes for new adventurers', () => {
    expect(SHOP_BASE_STOCK.small_fishing_net).toBeGreaterThan(0)
    expect(SHOP_BASE_STOCK.bronze_axe).toBeGreaterThan(0)
  })
})
