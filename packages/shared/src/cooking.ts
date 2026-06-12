import type { ItemId } from './items'

export type Cookable = Readonly<{
  raw: ItemId
  cooked: ItemId
  burnt: ItemId
  level: number
  xp: number
  burnStopLevel: number
  successMessage: string
  burnMessage: string
}>

export const COOKABLES: readonly Cookable[] = [
  {
    raw: 'raw_shrimps',
    cooked: 'shrimps',
    burnt: 'burnt_fish',
    level: 1,
    xp: 30,
    burnStopLevel: 34,
    successMessage: 'You successfully cook some shrimps.',
    burnMessage: 'You accidentally burn the shrimps.',
  },
  {
    raw: 'raw_beef',
    cooked: 'cooked_meat',
    burnt: 'burnt_fish',
    level: 1,
    xp: 30,
    burnStopLevel: 31,
    successMessage: 'You roast a piece of beef.',
    burnMessage: 'You accidentally burn the beef.',
  },
]

export const cookableFor = (itemId: ItemId): Cookable | undefined =>
  COOKABLES.find((cookable) => cookable.raw === itemId)

export const burnChance = (cookingLevel: number, cookable: Cookable): number =>
  cookingLevel >= cookable.burnStopLevel ? 0 : Math.max(0, 0.55 - 0.015 * cookingLevel)
