import type { ItemId } from './items'

export const NPC_DEF_IDS = ['guide', 'goblin', 'fisherman', 'cow', 'banker', 'shopkeeper'] as const

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
  shop?: boolean
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
  fisherman: {
    id: 'fisherman',
    name: 'Fisherman',
    examine: 'He smells distinctly of the sea.',
    dialogue: [
      'Lovely day for a spot of fishing!',
      'Grab a small fishing net from my hut and look for the shimmering spots in the water.',
      "Shrimps cook up nicely on a range or campfire - mind you don't burn them.",
    ],
  },
  cow: {
    id: 'cow',
    name: 'Cow',
    examine: 'Converts grass into beef.',
    combat: {
      hitpoints: 8,
      attackLevel: 1,
      strengthLevel: 1,
      defenceLevel: 1,
      attackSpeedTicks: 6,
    },
    drops: [
      { itemId: 'bones', quantity: 1 },
      { itemId: 'raw_beef', quantity: 1 },
    ],
  },
  shopkeeper: {
    id: 'shopkeeper',
    name: 'Shop keeper',
    examine: 'He sells a bit of everything.',
    shop: true,
    dialogue: [
      'Welcome to the General Store!',
      "Have a look at my wares - I'll buy almost anything too.",
    ],
  },
  banker: {
    id: 'banker',
    name: 'Banker',
    examine: 'He keeps a close eye on the vault.',
    dialogue: [
      'Good day! Welcome to the Bank of Gielinor.',
      'Use the booth to deposit your items - they will be safe with us.',
      'Your wealth is our pleasure.',
    ],
  },
}
