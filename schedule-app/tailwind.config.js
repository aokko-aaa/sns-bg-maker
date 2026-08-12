/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // モバイルファースト: タップ領域は最低44px（設計原則 2-4）
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      colors: {
        // group_key 別の基準色（カテゴリ色は個別 hex で上書きされる）
        group: {
          work: '#4F86F7',
          family: '#F7845F',
          personal: '#5FC77E',
        },
      },
    },
  },
  plugins: [],
}
