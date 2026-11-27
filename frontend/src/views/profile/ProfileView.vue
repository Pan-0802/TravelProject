<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">个人中心</h1>
        <p class="page-subtitle">管理你的账号资料与登录密码。</p>
      </div>
    </div>

    <div class="profile-grid">
      <div class="tp-card tp-card__body">
        <h2 class="card-title">基本信息</h2>

        <div class="profile-head">
          <el-avatar :size="64" class="profile-avatar">{{ auth.avatarText }}</el-avatar>
          <div>
            <div class="profile-name">{{ auth.user?.nickname || auth.user?.username || '—' }}</div>
            <div class="tp-muted">用户名：{{ auth.user?.username || '—' }}</div>
            <div class="tp-muted">注册时间：{{ dateTime(auth.user?.createdAt) }}</div>
          </div>
        </div>

        <el-form ref="nicknameFormRef" :model="nicknameForm" :rules="nicknameRules" label-width="72px">
          <el-form-item label="昵称" prop="nickname" :error="nicknameErrors.fieldErrors.nickname">
            <el-input
              v-model.trim="nicknameForm.nickname"
              maxlength="60"
              show-word-limit
              placeholder="请输入新的昵称"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="nicknameSaving" @click="saveNickname">保存昵称</el-button>
          </el-form-item>
        <el-alert v-if="nicknameErrors.submitError.value" :title="nicknameErrors.submitError.value" type="error" :closable="false" role="alert"/>
</el-form>
      </div>

      <div class="tp-card tp-card__body">
        <h2 class="card-title">修改密码</h2>
        <p class="tp-muted card-tip">修改成功后当前登录状态会失效，需要使用新密码重新登录。</p>

        <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="88px">
          <el-form-item label="当前密码" prop="oldPassword" :error="passwordErrors.fieldErrors.oldPassword">
            <el-input v-model="passwordForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword" :error="passwordErrors.fieldErrors.newPassword">
            <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="8-72 位" />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword" :error="passwordErrors.fieldErrors.confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              show-password
              placeholder="请再次输入新密码"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="passwordSaving" @click="savePassword">修改密码</el-button>
          </el-form-item>
        <el-alert v-if="passwordErrors.submitError.value" :title="passwordErrors.submitError.value" type="error" :closable="false" role="alert"/>
</el-form>
      </div>

      <div class="tp-card tp-card__body">
        <h2 class="card-title">系统信息</h2>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="接口前缀">{{ apiBase }}</el-descriptions-item>
          <el-descriptions-item label="运行模式">
            <el-tag :type="isMock ? 'warning' : 'success'" size="small" effect="plain">
              {{ isMock ? 'Mock 演示（本地数据）' : '真实后端接口' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="令牌方式">JWT Bearer，存于 sessionStorage</el-descriptions-item>
          <el-descriptions-item label="契约版本">API 对接文档 V1.0</el-descriptions-item>
        </el-descriptions>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useFormErrors} from "@/utils/formErrors"
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormItemRule, type FormRules } from 'element-plus'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { dateTime } from '@/utils/format'

const router = useRouter()
const auth = useAuthStore()

const apiBase = import.meta.env.VITE_API_BASE || '/api'
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

/* ===== 昵称 ===== */
const nicknameFormRef = ref<FormInstance>()
const nicknameErrors=useFormErrors()
const nicknameSaving = ref(false)
const nicknameForm = reactive({ nickname: auth.user?.nickname || '' })

const nicknameRules: FormRules = {
  nickname: [{ max: 60, message: '昵称最多 60 个字符', trigger: 'blur' }]
}

async function saveNickname() {
  nicknameErrors.clearErrors()
  const valid = await nicknameFormRef.value?.validate().catch(() => false)
  if (!valid) return

  nicknameSaving.value = true
  try {
    const user = await authApi.updateNickname({ nickname: nicknameForm.nickname })
    auth.applyUser(user)
    ElMessage.success('昵称已更新')
  } catch(error) {
    nicknameErrors.showError(error)
  } finally {
    nicknameSaving.value = false
  }
}

/* ===== 密码 ===== */
const passwordFormRef = ref<FormInstance>()
const passwordErrors=useFormErrors()
const passwordSaving = ref(false)
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const validateConfirm: FormItemRule['validator'] = (_rule, value, callback) => {
  if (!value) return callback(new Error('请再次输入新密码'))
  if (value !== passwordForm.newPassword) return callback(new Error('两次输入的新密码不一致'))
  callback()
}

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 72, message: '密码长度应为 8-72 个字符', trigger: 'blur' }
  ],
  confirmPassword: [{ required: true, validator: validateConfirm, trigger: 'blur' }]
}

async function savePassword() {
  passwordErrors.clearErrors()
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid) return

  passwordSaving.value = true
  try {
    await authApi.changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })
    ElMessage.success('密码已修改，请使用新密码重新登录')
    auth.resetLocal()
    await router.replace('/auth/login')
  } catch(error) {
    passwordErrors.showError(error)
  } finally {
    passwordSaving.value = false
  }
}
</script>

<style scoped>
.profile-grid {
  display: flex;
  flex-wrap: wrap;
  gap:16px;
  align-items: stretch;
}

/* 三张卡片等宽等高：flex 拉伸保证上边界、下边界都对齐 */
.profile-grid > .tp-card {
  flex: 1 1 0;
  min-width: 340px;
  margin-top:0;
  display: flex;
  flex-direction: column;
}

/* 内容顶部对齐，按钮固定在卡片底部，视觉上更整齐 */
.profile-grid > .tp-card > .el-form {
  margin-top:auto;
}

.profile-grid .card-title {
  min-height: 24px;
  display: flex;
  align-items: center;
}

.card-title {
  margin:0 0 16px;
  font-size: var(--tp-font-section);
  font-weight: 600;
}

.card-tip {
  margin:-8px 0 12px;
}

.profile-head {
  display: flex;
  align-items: center;
  gap:16px;
  margin-bottom:16px;
}

.profile-avatar {
  background: var(--tp-primary);
  color:#ffffff;
  font-size: var(--tp-font-title);
  font-weight: 700;
}

.profile-name {
  font-size: var(--tp-font-section);
  font-weight: 600;
  margin-bottom:4px;
}
</style>
