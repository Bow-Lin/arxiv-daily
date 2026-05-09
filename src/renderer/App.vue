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
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { useToastStore } from './stores/toast'
import { useConfigStore } from './stores/config'

const toastStore = useToastStore()
const configStore = useConfigStore()
const expanded = ref(new Set<number>())

function applyTheme(t: string) {
  let resolved: 'light' | 'dark'
  if (t === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } else {
    resolved = t as 'light' | 'dark'
  }
  document.documentElement.setAttribute('data-theme', resolved)
}

watch(() => configStore.theme, (val) => applyTheme(val), { immediate: true })

let mediaQuery: MediaQueryList | null = null
const onSystemThemeChange = () => {
  if (configStore.theme === 'system') applyTheme('system')
}

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onSystemThemeChange)
})

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', onSystemThemeChange)
})

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
  background: var(--bg-primary);
  color: var(--text-primary);
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-secondary) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background: var(--border-secondary);
  border-radius: 3px;
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--text-placeholder);
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
  color: var(--text-tertiary);
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
  color: var(--text-placeholder);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-close:hover {
  color: var(--text-tertiary);
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
  color: var(--color-primary);
  flex-shrink: 0;
}

.toast-toggle:hover {
  color: var(--color-primary-hover);
  background: transparent;
}

.toast-error .toast-toggle {
  color: var(--color-error);
}

.toast-error .toast-toggle:hover {
  background: var(--color-error-bg);
}

.toast-details {
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.toast-success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
}

.toast-success .toast-title {
  color: var(--color-success);
}

.toast-info {
  background: var(--color-primary-bg);
  border: 1px solid var(--color-primary-border);
}

.toast-info .toast-title {
  color: var(--color-primary);
}

.toast-error {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
}

.toast-error .toast-title {
  color: var(--color-error);
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
