<template>
  <div class="list-pagination" aria-label="分页">
    <span class="tp-muted" role="status">第 {{ first }}–{{ last }} 条，共 {{ total }} 条</span>
    <el-pagination :current-page="page" :page-size="20" :total="total" :pager-count="5"
      layout="prev, pager, next, jumper" background
      @current-change="(value: number) => emit('change', value)" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ page: number; total: number }>()
const emit = defineEmits<{ (e: 'change', page: number): void }>()
const first = computed(() => props.total ? (props.page - 1) * 20 + 1 : 0)
const last = computed(() => Math.min(props.page * 20, props.total))
</script>

<style scoped>
.list-pagination { container-type:inline-size; }
.list-pagination :deep(.el-pagination) { max-width:100%;flex-wrap:wrap;justify-content:flex-end;row-gap:8px; }
@container (max-width:360px) {
  .list-pagination :deep(.el-pagination__jump) { display:none; }
  .list-pagination :deep(.btn-prev),
  .list-pagination :deep(.btn-next),
  .list-pagination :deep(.el-pager li) { min-width:24px;height:28px;line-height:28px; }
}
</style>
