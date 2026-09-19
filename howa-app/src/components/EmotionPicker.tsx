import { EMOTIONS } from '../data/emotions'
import type { EmotionGroup, EmotionId } from '../data/types'

const GROUP_ORDER: EmotionGroup[] = ['くるしみ', 'ざわつき', 'ゆらぎ', 'しあわせ']

type Props = {
  selected: EmotionId[]
  onToggle: (id: EmotionId) => void
  /** 自由記述から自動で拾われたもの（点線で示す） */
  detected?: EmotionId[]
}

export default function EmotionPicker({ selected, onToggle, detected = [] }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {GROUP_ORDER.map((group) => (
        <div key={group}>
          <div className="label mb-1.5">{group}</div>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.filter((e) => e.group === group).map((e) => {
              const on = selected.includes(e.id)
              const auto = !on && detected.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onToggle(e.id)}
                  className={`chip ${on ? 'chip-on' : ''} ${
                    auto ? 'border-dashed border-enji/60 text-enji' : ''
                  }`}
                  title={e.plain}
                >
                  {e.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
