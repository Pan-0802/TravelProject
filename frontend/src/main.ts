import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import './styles/main.css'
import App from './App.vue'
import router from './router'

async function bootstrap() {
  // Mock 模式：不启动后端也能演示全部页面（npm run dev:mock）
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { setupMock } = await import('./mock')
    await setupMock()
  }

  const app = createApp(App)

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(createPinia())
  app.use(router)
  app.use(ElementPlus, { locale: zhCn })
  app.mount('#app')
}

bootstrap()
