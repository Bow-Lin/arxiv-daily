import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  title: string
  body: string
  type: 'success' | 'info' | 'error'
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(title: string, body: string, type: 'success' | 'info' | 'error' = 'info') {
    const id = nextId++
    toasts.value.push({ id, title, body, type })
    setTimeout(() => remove(id), 3000)
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, remove }
})
