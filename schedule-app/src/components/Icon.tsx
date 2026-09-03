/**
 * public/icons/ui/*.svg を currentColor で着色して表示するアイコン。
 * SVGを mask として使うので、置かれた場所の文字色（text-***）に自動追従する。
 * 例: グレーのヘッダー→グレー、青いボタン上→白、選択中タブ→青。
 */
export default function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: 'bg' | 'add' | 'schedule' | 'settings' | 'mic'
  size?: number
  className?: string
}) {
  const url = `/icons/ui/${name}.svg`
  return (
    <span
      aria-hidden
      className={'inline-block shrink-0 ' + className}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}
