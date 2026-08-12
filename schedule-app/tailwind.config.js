/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // モバイルファースト: タップ領域は最低44px（設計原則 2-4）
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      colors: {
        // group_key 別の基準色（背景のパステル調に合わせたトーン）
        // ※ src/lib/palette.ts の GROUP_COLORS と揃えること
        group: {
          work: '#5E97D0',
          family: '#E58C74',
          personal: '#6FBF9B',
        },
      },
    },
  },
  plugins: [],
}
