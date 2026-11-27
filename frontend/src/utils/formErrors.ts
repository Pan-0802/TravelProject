import { reactive, ref } from 'vue'
import { errorMessage, type ApiError } from './request'

/** Field errors persist beside the input; form-wide errors retain the user's values. */
export function useFormErrors(aliases: Record<string, string> = {}) {
  const fieldErrors = reactive<Record<string, string>>({})
  const submitError = ref('')
  function clearErrors() {
    submitError.value = ''
    Object.keys(fieldErrors).forEach(key => delete fieldErrors[key])
  }
  function showError(error: unknown) {
    clearErrors()
    const api = error as ApiError
    Object.entries(api.fieldErrors || {}).forEach(([key, message]) => {
      const unindexed = key.replace(/\[\d+\]/g, '')
      const target = aliases[key] || aliases[unindexed] || key.replace(/\[(\d+)\]/g, '.$1')
      fieldErrors[target] ||= message
    })
    submitError.value = errorMessage(error, '保存未完成，请检查填写内容后重试；已填写的信息会保留。')
  }
  return { fieldErrors, submitError, clearErrors, showError }
}
