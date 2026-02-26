import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "./" // ye ensure karta hai ki Vercel me assets correct load ho
})