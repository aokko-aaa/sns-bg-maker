/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // モバイルファースト: タップ領域は最低44px
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      colors: {
        // 墨と生成り（法話の下ごしらえ帳のトーン）
        sumi: '#2b2622',
        kinari: '#f7f3ea',
        enji: '#9b4a3f',
        matcha: '#6b7f5a',
      },
    },
  },
  plugins: [],
}
