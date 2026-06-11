import type { DialogueState } from '../store/reducer'

type Props = Readonly<{
  dialogue: DialogueState
  onAdvance: () => void
}>

export const DialogueBox = ({ dialogue, onAdvance }: Props) => (
  <button type="button" className="dialogue-box panel" onClick={onAdvance}>
    <div className="dialogue-npc-name">{dialogue.npcName}</div>
    <div className="dialogue-line">{dialogue.lines[dialogue.index]}</div>
    <div className="dialogue-continue">Click here to continue</div>
  </button>
)
