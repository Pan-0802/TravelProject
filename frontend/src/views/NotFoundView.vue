<template>
  <div class="not-found">
    <h1>404</h1>
    <p>你访问的页面不存在，或链接已失效。</p>
    <el-button type="primary" @click="router.replace('/trips')">返回旅行计划</el-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap:12px;
  background: var(--tp-bg);
}

.not-found h1 {
  font-size: var(--tp-font-title);
  margin:0;
  color: var(--tp-primary);
  letter-spacing: 4px;
}

.not-found p {
  margin:0 0 12px;
  color: var(--tp-text-secondary);
}
</style>
