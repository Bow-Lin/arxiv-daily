<template>
  <div class="app">
    <router-view />
    <Teleport to="body">
      <div class="toast-container">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          :class="['toast-item', `toast-${toast.type}`, { 'toast-removing': toast.removing }]"
        >
          <span class="toast-title">{{ toast.title }}</span>
          <span class="toast-body">{{ toast.body }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from './stores/toast'

const toastStore = useToastStore()
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
  align-items: center;
  gap: 8px;
  animation: toastIn 0.25s ease;
  white-space: nowrap;
}

.toast-item.toast-removing {
  animation: toastOut 0.25s ease forwards;
}

.toast-title {
  font-weight: 600;
  flex-shrink: 0;
}

.toast-body {
  color: #6b7280;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
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
