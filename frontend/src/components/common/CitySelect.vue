<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :style="{ width }"
    filterable
    allow-create
    default-first-option
    @update:model-value="handleUpdate"
  >
    <el-option-group v-for="group in groups" :key="group.province" :label="group.province">
      <el-option
        v-for="option in group.options"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-option-group>
  </el-select>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_GROUPS, CITY_VALUE_SET, type CityGroup } from '@/constants'

/**
 * 全国省市下拉：按省分组，值形如「四川省成都市」。
 * 旧数据里可能存的是简称（如「重庆」），这里会自动补一个选项保证能正常显示。
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    width?: string
  }>(),
  {
    modelValue: '',
    placeholder: '请选择城市',
    disabled: false,
    clearable: true,
    width: '100%'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const groups = computed<CityGroup[]>(() => {
  const current = props.modelValue || ''
  if (current && !CITY_VALUE_SET.has(current)) {
    return [{ province: '当前填写', options: [{ value: current, label: current }] }, ...CITY_GROUPS]
  }
  return CITY_GROUPS
})

function handleUpdate(value: string) {
  const next = value || ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
