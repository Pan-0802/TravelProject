<template>
  <el-dialog :model-value="modelValue" title="消费详情" width="min(560px,94vw)" destroy-on-close
    @update:model-value="(value:boolean)=>emit('update:modelValue',value)">
    <el-descriptions v-if="expense" :column="1" border>
      <el-descriptions-item label="旅行">{{trip.title}}</el-descriptions-item>
      <el-descriptions-item label="消费日期">{{expense.spentOn}}</el-descriptions-item>
      <el-descriptions-item label="类别">{{EXPENSE_CATEGORY_LABELS[expense.category]}}</el-descriptions-item>
      <el-descriptions-item label="金额">{{money(expense.amount)}}</el-descriptions-item>
      <el-descriptions-item label="说明">{{expense.description||'未填写'}}</el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" role="alert"/>
    <template #footer>
      <el-button :disabled="deleting" @click="emit('update:modelValue',false)">关闭</el-button>
      <el-button :disabled="deleting" @click="editing=true">编辑消费</el-button>
      <el-button type="danger" plain :loading="deleting" @click="remove">删除消费</el-button>
    </template>
    <ExpenseFormDialog v-if="expense" v-model="editing" :trip="trip" :expense="expense" @saved="updated"/>
  </el-dialog>
</template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import ExpenseFormDialog from './ExpenseFormDialog.vue'
import {expenseApi} from '@/api/expense'
import {EXPENSE_CATEGORY_LABELS} from '@/constants'
import {money} from '@/utils/format'
import {errorMessage} from '@/utils/request'
import type {Expense,Trip} from '@/types/api'
const props=defineProps<{modelValue:boolean;expense:Expense|null;trip:Trip}>()
const emit=defineEmits<{(e:'update:modelValue',v:boolean):void;(e:'changed'):void}>()
const editing=ref(false),deleting=ref(false),failure=ref('')
watch(()=>props.modelValue,()=>{failure.value='';editing.value=false})
function updated(){editing.value=false;emit('update:modelValue',false);emit('changed')}
async function remove(){
  if(!props.expense||deleting.value)return
  const expense=props.expense
  try{await ElMessageBox.confirm(`删除 ${expense.spentOn} 的「${EXPENSE_CATEGORY_LABELS[expense.category]} ${money(expense.amount)}」后无法恢复，旅行的支出统计会重新计算。确定删除吗？`,'删除消费',{confirmButtonText:'删除',cancelButtonText:'取消',type:'warning'})}catch{return}
  deleting.value=true;failure.value=''
  try{await expenseApi.remove(expense.expenseId);ElMessage.success('消费已删除，统计已刷新');emit('update:modelValue',false);emit('changed')}
  catch(e){failure.value=errorMessage(e)}finally{deleting.value=false}
}
</script>
