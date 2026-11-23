<template>
  <el-dialog
    :model-value="modelValue"
    title="景点详情"
    width="560px"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="attraction" class="detail">
      <h3 class="detail__name">{{ attraction.name }}</h3>
      <p class="detail__meta">
        <el-tag size="small" effect="plain">{{ attraction.city }}</el-tag>
        <el-tag v-if="attraction.category" size="small" effect="plain" type="info">
          {{ attraction.category }}
        </el-tag>
        <el-tag v-if="attraction.isOwner" size="small" effect="plain" type="success">我创建的</el-tag>
        <el-tag v-if="attraction.isFavorited" size="small" effect="plain" type="warning">已收藏</el-tag>
      </p>

      <el-descriptions :column="1" border size="small" class="detail__desc">
        <el-descriptions-item label="建议游玩">
          {{ durationText(attraction.suggestedDurationMinutes) }}
        </el-descriptions-item>
        <el-descriptions-item label="参考门票">
          {{ attraction.referenceTicketPrice === null ? '未填写' : money(attraction.referenceTicketPrice) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述">
          {{ attraction.description || '暂无描述' }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Attraction } from '@/types/api'
import { durationText, money } from '@/utils/format'

defineProps<{
  modelValue: boolean
  attraction: Attraction | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<style scoped>
.detail__name {
  margin: 0 0 10px;
  font-size: 18px;
}

.detail__meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 16px;
}

.detail__desc :deep(.el-descriptions__cell) {
  line-height: 1.7;
}
</style>
