import * as echarts from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue'

const chartTypography = {
  textStyle: { fontFamily: 'Microsoft YaHei, Arial, sans-serif', fontSize: 14 },
  title: { textStyle: { fontSize: 18 }, subtextStyle: { fontSize: 14 } },
  legend: { textStyle: { fontSize: 14 } },
  tooltip: { textStyle: { fontSize: 14 } },
  categoryAxis: { axisLabel: { fontSize: 14 }, nameTextStyle: { fontSize: 14 } },
  valueAxis: { axisLabel: { fontSize: 14 }, nameTextStyle: { fontSize: 14 } },
  pie: { label: { fontSize: 14 } },
  bar: { label: { fontSize: 14 } }
}

/**
 * ECharts 轻量封装：自动初始化、随容器尺寸变化 resize、卸载时 dispose。
 * 容器可能因 v-if 延迟出现，这里监听容器引用并在出现后初始化。
 * 用法：const { setOption } = useEcharts(boxRef)
 */
export function useEcharts(containerRef: Ref<HTMLElement | null | undefined>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let pendingOption: Record<string, unknown> | null = null
  let observer: ResizeObserver | null = null

  function setOption(option: Record<string, unknown>) {
    pendingOption = option
    if (chart.value) {
      chart.value.setOption(option as echarts.EChartsOption, true)
    }
  }

  function init() {
    if (!containerRef.value || !containerRef.value.clientWidth || !containerRef.value.clientHeight) return
    if (chart.value?.getDom() === containerRef.value) { chart.value.resize(); return }
    dispose()
    chart.value = echarts.init(containerRef.value, chartTypography)
    if (pendingOption) chart.value.setOption(pendingOption as echarts.EChartsOption, true)
  }

  function dispose() {
    chart.value?.dispose()
    chart.value = null
  }

  function observe() {
    observer?.disconnect()
    dispose()
    if (!containerRef.value) return
    observer = new ResizeObserver(init)
    observer.observe(containerRef.value)
    init()
  }

  onMounted(observe)

  watch(containerRef, () => nextTick(observe), { flush: 'post' })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
    dispose()
  })

  return { chart, setOption }
}
