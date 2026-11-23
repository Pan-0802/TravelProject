<template>
  <div class="auth-card">
    <h2 class="auth-card__title">创建账号</h2>
    <p class="auth-card__subtitle">注册后即可创建旅行计划、记录消费与使用 AI 规划</p>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      size="large"
      @submit.prevent="handleSubmit"
    >
      <el-form-item label="用户名" prop="username">
        <el-input v-model.trim="form.username" placeholder="1-50 位，建议字母/数字/下划线" clearable />
      </el-form-item>

      <el-form-item label="昵称（可选）" prop="nickname">
        <el-input v-model.trim="form.nickname" placeholder="最多 60 字" clearable maxlength="60" />
      </el-form-item>

      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" placeholder="8-72 位" show-password />
      </el-form-item>

      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          show-password
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
        注册
      </el-button>
    </el-form>

    <div class="auth-card__footer">
      <span>已有账号？</span>
      <router-link to="/auth/login">返回登录</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormItemRule, type FormRules } from 'element-plus'
import { authApi } from '@/api/auth'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

const validateConfirm: FormItemRule['validator'] = (_rule, value, callback) => {
  if (!value) return callback(new Error('请再次输入密码'))
  if (value !== form.password) return callback(new Error('两次输入的密码不一致'))
  callback()
}

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 1, max: 50, message: '用户名长度应为 1-50 个字符', trigger: 'blur' },
    {
      pattern: /^[A-Za-z0-9_]+$/,
      message: '建议仅使用英文字母、数字、下划线',
      trigger: 'blur'
    }
  ],
  nickname: [{ max: 60, message: '昵称最多 60 个字符', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 72, message: '密码长度应为 8-72 个字符', trigger: 'blur' }
  ],
  confirmPassword: [{ required: true, validator: validateConfirm, trigger: 'blur' }]
}

async function handleSubmit() {
  if (loading.value) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authApi.register({
      username: form.username,
      password: form.password,
      confirmPassword: form.confirmPassword,
      nickname: form.nickname || undefined
    })
    ElMessage.success('注册成功，请登录')
    await router.replace({ path: '/auth/login', query: { username: form.username } })
  } catch {
    // 409 用户名重复等错误已由拦截器提示
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-card__title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
}

.auth-card__subtitle {
  margin: 0 0 22px;
  color: var(--tp-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.auth-card__submit {
  width: 100%;
  margin-top: 4px;
}

.auth-card__footer {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
  color: var(--tp-text-secondary);
  display: flex;
  justify-content: center;
  gap: 6px;
}
</style>
