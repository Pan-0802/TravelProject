<template>
  <div class="auth-card">
    <h2 class="auth-card__title">欢迎回来</h2>
    <p class="auth-card__subtitle">登录后管理你的旅行计划与行程</p>

    <el-alert
      v-if="isMock"
      type="warning"
      :closable="false"
      show-icon
      class="auth-card__alert"
      title="Mock 演示模式"
      description="可直接用 demo_zhang / Test@123456 登录，数据保存在浏览器本地。"
    />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="用户名" prop="username" :error="fieldErrors.username">
        <el-input
          v-model.trim="form.username"
          placeholder="请输入用户名"
          :prefix-icon="User"
          clearable
          autocomplete="username"
        />
      </el-form-item>

      <el-form-item label="密码" prop="password" :error="fieldErrors.password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          :prefix-icon="Lock"
          show-password
          autocomplete="current-password"
          @keyup.enter="handleSubmit"
        />
      </el-form-item>

      <el-button
        type="primary"
        class="auth-card__submit"
        :loading="loading"
        native-type="submit"
        @click="handleSubmit"
      >
        登录
      </el-button>
    <el-alert v-if="submitError" :title="submitError" type="error" :closable="false" role="alert" />
</el-form>

    <div class="auth-card__footer">
      <span>还没有账号？</span>
      <router-link to="/auth/register">立即注册</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFormErrors } from "@/utils/formErrors"
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const {fieldErrors,submitError,clearErrors,showError}=useFormErrors()
const loading = ref(false)
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

const form = reactive({ username: '', password: '' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleSubmit() {
  clearErrors()
  if (loading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/trips'
    await router.replace(redirect)
  } catch (error) {
    showError(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 注册成功后带回用户名，省去重复输入
  const username = route.query.username as string | undefined
  if (username) form.username = username
})
</script>

<style scoped>
.auth-card__title {
  margin:0 0 4px;
  font-size: var(--tp-font-title);
  font-weight: 700;
}

.auth-card__subtitle {
  margin:0 0 24px;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}

.auth-card__alert {
  margin-bottom:16px;
}

.auth-card__submit {
  width: 100%;
  margin-top:4px;
}

.auth-card__footer {
  margin-top:16px;
  text-align: center;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
  display: flex;
  justify-content: center;
  gap:4px;
}
</style>
