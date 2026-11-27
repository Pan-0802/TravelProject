<template>
  <div class="auth-shell">
    <section class="auth-brand">
      <div class="auth-brand__logo">
        <el-icon :size="28"><MapLocation /></el-icon>
        <span>Travel Planner</span>
      </div>
      <h1 class="auth-brand__title">个人旅行记录与智能规划系统</h1>
      <p class="auth-brand__desc">
        记录每一次出发：旅行计划、每日行程、消费预算与 AI 智能规划，一处管理。
      </p>
      <ul class="auth-brand__list">
        <li><el-icon><Calendar /></el-icon> 按天安排行程，随手增删改</li>
        <li><el-icon><PieChart /></el-icon> 消费分类统计与预算执行</li>
        <li><el-icon><MagicStick /></el-icon> AI 生成结构化旅行方案</li>
      </ul>
      <p class="auth-brand__foot">《数据库原理与应用》课程设计</p>
    </section>

    <section class="auth-panel">
      <div class="auth-panel__inner">
        <router-view />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.auth-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(380px, 0.9fr);
  background: #f4f6fb;
}

.auth-brand {
  position: relative;
  padding:24px 24px;
  color:#ffffff;
  background: linear-gradient(145deg, #2f5fd0 0%, #3f7ef7 45%, #63a0ff 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.auth-brand::after {
  content: '';
  position: absolute;
  width: 520px;
  height: 520px;
  right: -180px;
  bottom: -220px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.auth-brand__logo {
  display: flex;
  align-items: center;
  gap:8px;
  font-size: var(--tp-font-section);
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-bottom:24px;
}

.auth-brand__title {
  font-size: var(--tp-font-title);
  line-height: 1.35;
  margin:0 0 16px;
  font-weight: 700;
}

.auth-brand__desc {
  font-size: var(--tp-font-body);
  line-height: 1.8;
  margin:0 0 24px;
  max-width: 460px;
  opacity: 0.92;
}

.auth-brand__list {
  list-style: none;
  padding:0;
  margin:0 0 24px;
  display: grid;
  gap:12px;
  font-size: var(--tp-font-body);
}

.auth-brand__list li {
  display: flex;
  align-items: center;
  gap:8px;
  opacity: 0.95;
}

.auth-brand__foot {
  margin:0;
  font-size: var(--tp-font-body);
  opacity: 0.75;
}

.auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding:24px 24px;
}

.auth-panel__inner {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding:24px 24px;
  box-shadow: 0 12px 40px rgba(31, 45, 61, 0.1);
}

@media (max-width: 900px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }
  .auth-brand {
    padding:24px 24px;
    justify-content: flex-start;
  }
  .auth-brand__title {
    font-size: var(--tp-font-title);
  }
  .auth-brand__list,
  .auth-brand__desc {
    display: none;
  }
  .auth-brand__foot {
    display: none;
  }
}
</style>
