import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import router from './router'
import App from './App.vue'
import { initStorage } from './utils/storage'
import './styles/global.less'

async function bootstrap() {
  // In Electron, sync persisted files to localStorage before app starts
  await initStorage()

  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(Antd)
  app.mount('#app')
}

bootstrap()
