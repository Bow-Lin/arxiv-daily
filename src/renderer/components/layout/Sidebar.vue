<template>
  <aside class="sidebar">
    <div class="dates-section">
      <div
        class="nav-item"
        :class="{ active: !papersStore.selectedDate }"
        @click="selectDate(null)"
      >
        <span class="nav-label">全部论文</span>
        <span class="nav-count">{{ papersStore.totalCount }}</span>
      </div>
      <div class="divider"></div>
      <div
        v-for="fd in papersStore.fetchDates"
        :key="fd.date"
        class="nav-item"
        :class="{ active: papersStore.selectedDate === fd.date }"
        @click="selectDate(fd.date)"
      >
        <span class="nav-label">{{ fd.display }}</span>
        <span class="nav-count">{{ fd.count }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { usePapersStore } from '../../stores/papers'

const papersStore = usePapersStore()

const selectDate = (date: string | null) => {
  papersStore.selectDate(date)
}
</script>

<style scoped>
.sidebar {
  width: 100%;
  min-width: 180px;
  background: #f9fafb;
  border-right: none;
  padding: 16px 12px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.dates-section {
  flex: 1;
  min-height: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
  user-select: none;
}

.nav-item:hover {
  background: #f0f0f0;
}

.nav-item.active {
  background: #eff6ff;
  color: #2563eb;
}

.nav-label {
  flex: 1;
  font-size: 14px;
}

.nav-count {
  font-size: 12px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 10px;
}

.divider {
  height: 1px;
  background: #e8e8e8;
  margin: 16px 0;
}
</style>
