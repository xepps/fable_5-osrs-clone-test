import type { ItemId } from './items'

export const NPC_DEF_IDS = ['guide', 'goblin'] as const

export type NpcDefId = (typeof NPC_DEF_IDS)[number]

export type NpcCombatProfile = Readonly<{
  hitpoints: number
  attackLevel: number
  strengthLevel: number
  defenceLevel: number
  attackSpeedTicks: number
}>

export type NpcDrop = Readonly<{ itemId: ItemId; quantity: number }>

export type NpcDef = Readonly<{
  id: NpcDefId
  name: string
  examine: string
  combat?: NpcCombatProfile
  drops?: readonly NpcDrop[]
  dialogue?: readonly string[]
}>

export const NPCS: Readonly<Record<NpcDefId, NpcDef>> = {
  guide: {
    id: 'guide',
    name: 'Lumbridge Guide',
    examine: 'He knows a lot about this place.',
    dialogue: [
      'Greetings, adventurer! Welcome to the world.',
      'Left-click to walk, and right-click things to see what you can do with them.',
      'There are some items by the crossroads - take them, and try Wielding the sword.',
      'The goblins to the south-west are good practice if you fancy a fight.',
      'You can chop the trees for logs too, if you have an axe. Good luck!',
    ],
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    examine: 'An ugly green creature.',
    combat: {
      hitpoints: 5,
      attackLevel: 1,
      strengthLevel: 1,
      defenceLevel: 1,
      attackSpeedTicks: 4,
    },
    drops: [
      { itemId: 'bones', quantity: 1 },
      { itemId: 'coins', quantity: 5 },
    ],
  },
}
