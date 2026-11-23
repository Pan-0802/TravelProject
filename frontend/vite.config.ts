import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// 前端开发约定：http://localhost:5173 ，/api 代理到后端 http://localhost:8080
// 若后端在同事电脑上，把 TARGET 改成局域网 IP（如 http://192.168.1.20:8080）
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const TARGET = process.env.VITE_PROXY_TARGET || env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080'
  const proxy = { '/api': { target: TARGET, changeOrigin: true }, '/health': { target: TARGET, changeOrigin: true } }
  return {
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy
  },
  preview: { port: 4173, strictPort: true, proxy },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const path = id.replace(/\\/g, '/')
          if (path.includes('/node_modules/echarts/') || path.includes('/node_modules/zrender/')) return 'echarts'
          if (path.includes('/node_modules/element-plus/')) return 'element'
        }
      }
    }
  }
  }
})
