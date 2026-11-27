<template>
  <div v-if="message" class="request-error" role="alert">
    <div><strong>暂时无法获取数据</strong><p>{{ message }}</p></div>
    <el-button :loading="loading" @click="emit('retry')">重试</el-button>
  </div>
</template>
<script setup lang="ts">
defineProps<{ message: string; loading?: boolean }>()
const emit = defineEmits<{ (e: 'retry'): void }>()
</script>
