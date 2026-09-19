import type { Neta } from '../data/types'
import { SECTION } from './generate'

/** 見出しつきの下書き（推敲用） */
export function toScript(neta: Neta): string {
  const head = `■ ${neta.title}\n切り口：${neta.angleName}（${neta.aim}）`
  const body = neta.sections.map((s) => `【${s.label}】\n${s.body}`).join('\n\n')
  const src = neta.sources.length ? `\n\n[出典]\n${neta.sources.map((s) => `・${s}`).join('\n')}` : ''
  const caution = neta.cautions.length
    ? `\n\n[語る前に確認]\n${neta.cautions.map((s) => `・${s}`).join('\n')}`
    : ''
  return `${head}\n\n${body}${src}${caution}\n`
}

/** 見出しと語り手向けメモを外して、そのまま読み上げられる形に */
export function toProse(neta: Neta): string {
  return neta.sections
    .filter((s) => s.label !== SECTION.memo)
    .map((s) => s.body)
    .join('\n\n')
}

export function toMarkdown(netas: { neta: Neta; memo?: string }[]): string {
  return netas
    .map(({ neta, memo }) => {
      const memoLine = memo ? `\n\n> メモ: ${memo}` : ''
      return `## ${neta.title}\n\n切り口：${neta.angleName}\n\n${neta.sections
        .map((s) => `**${s.label}**\n\n${s.body}`)
        .join('\n\n')}${
        neta.sources.length ? `\n\n出典: ${neta.sources.join(' / ')}` : ''
      }${memoLine}`
    })
    .join('\n\n---\n\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
