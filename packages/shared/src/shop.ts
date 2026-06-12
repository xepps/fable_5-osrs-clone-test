import { ITEMS, type ItemId } from './items'

export const SHOP_BASE_STOCK: Readonly<Partial<Record<ItemId, number>>> = {
  small_fishing_net: 5,
  bronze_axe: 5,
  bronze_sword: 3,
  bronze_med_helm: 3,
}

export const buyPrice = (itemId: ItemId): number => ITEMS[itemId].value

export const sellPrice = (itemId: ItemId): number => Math.floor(ITEMS[itemId].value * 0.4)
