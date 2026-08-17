import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace-root',
      component: () => import('@/views/Workspace.vue'),
    },
    {
      path: '/workspace/:projectId?',
      name: 'workspace',
      component: () => import('@/views/Workspace.vue'),
    },
  ],
})

export default router
