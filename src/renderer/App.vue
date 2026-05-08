<template>
  <div class="app">
    <router-view />
    <Teleport to="body">
      <div class="toast-container">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          :class="['toast-item', `toast-${toast.type}`, { 'toast-removing': toast.removing, 'toast-expanded': expanded.has(toast.id) }]"
        >
          <div class="toast-main">
            <span class="toast-title">{{ toast.title }}</span>
            <span class="toast-body">{{ toast.body }}</span>
            <button
              v-if="toast.details"
              class="toast-toggle"
              @click.stop="toggleExpand(toast.id)"
            >
              {{ expanded.has(toast.id) ? '收起' : '详情' }}
            </button>
            <button class="toast-close" @click.stop="toastStore.remove(toast.id)">
              <X :size="12" />
            </button>
          </div>
          <div v-if="toast.details && expanded.has(toast.id)" class="toast-details">
            {{ toast.details }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import { useToastStore } from './stores/toast'

const toastStore = useToastStore()
const expanded = ref(new Set<number>())

function toggleExpand(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #ffffff;
  color: #1a1a1a;
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Toast notifications */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 400;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: toastIn 0.25s ease;
  width: 300px;
  pointer-events: auto;
}

.toast-item.toast-removing {
  animation: toastOut 0.25s ease forwards;
}

.toast-main {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.toast-title {
  font-weight: 600;
  flex-shrink: 0;
}

.toast-body {
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-close {
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-close:hover {
  color: #6b7280;
}

.toast-close:only-of-type {
  margin-left: auto;
}

.toast-toggle {
  margin-left: auto;
  padding: 2px 4px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: #2563eb;
  flex-shrink: 0;
}

.toast-toggle:hover {
  color: #1d4ed8;
  background: transparent;
}

.toast-error .toast-toggle {
  color: #dc2626;
}

.toast-error .toast-toggle:hover {
  background: rgba(220, 38, 38, 0.08);
}

.toast-details {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.toast-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.toast-success .toast-title {
  color: #059669;
}

.toast-info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.toast-info .toast-title {
  color: #2563eb;
}

.toast-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.toast-error .toast-title {
  color: #dc2626;
}

@keyframes toastIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toastOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>
