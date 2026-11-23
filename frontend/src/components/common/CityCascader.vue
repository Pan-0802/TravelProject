<template>
  <el-cascader
    :model-value="modelValue"
    :options="options"
    :props="cascaderProps"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :show-all-levels="true"
    :style="{ width }"
    filterable
    @update:model-value="handleUpdate"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PROVINCE_CITIES } from '@/constants'

/**
 * 两级城市选择：先选省，再选该省下的市（直辖市/港澳直接选）。
 * 选中值统一为「省+市」，如「四川省成都市」；旧数据里的简称会作为一项保留。
 */
interface CascaderOption {
  value: string
  label: string
  children?: CascaderOption[]
}

const MUNICIPALITIES = new Set(['北京市', '天津市', '上海市', '重庆市', '香港特别行政区', '澳门特别行政区'])

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
    placeholder: '请选择省市',
    disabled: false,
    clearable: true,
    width: '100%'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const cascaderProps = {
  value: 'value',
  label: 'label',
  children: 'children',
  emitPath: false,
  expandTrigger: 'click' as const
}

const baseOptions: CascaderOption[] = Object.entries(PROVINCE_CITIES).map(([province, cities]) => {
  if (MUNICIPALITIES.has(province)) {
    return { value: province, label: province }
  }
  return {
    value: province,
    label: province,
    children: cities.map((city) => ({ value: `${province}${city}`, label: city }))
  }
})

const leafValues = new Set<string>()
for (const option of baseOptions) {
  if (option.children) {
    option.children.forEach((child) => leafValues.add(child.value))
  } else {
    leafValues.add(option.value)
  }
}

const options = computed<CascaderOption[]>(() => {
  const current = props.modelValue || ''
  if (current && !leafValues.has(current)) {
    return [{ value: current, label: current }, ...baseOptions]
  }
  return baseOptions
})

function handleUpdate(value: string | number | null) {
  const next = value ? String(value) : ''
  emit('update:modelValue', next)
  emit('change', next)
}
</script>
