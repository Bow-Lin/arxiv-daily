import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  title: string
  body: string
  type: 'success' | 'info' | 'error'
  removing: boolean
  details?: string
  duration?: number
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(
    title: string,
    body: string,
    type: 'success' | 'info' | 'error' = 'info',
    details?: string,
    duration?: number,
  ) {
    const id = nextId++
    const actualDuration = duration ?? (type === 'error' ? 0 : (details ? 8000 : 3000))
    toasts.value.push({ id, title, body, type, removing: false, details })
    if (actualDuration > 0) {
      setTimeout(() => remove(id), actualDuration)
    }
  }

  function remove(id: number) {
    const toast = toasts.value.find(t => t.id === id)
    if (!toast || toast.removing) return
    toast.removing = true
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 250)
  }

  return { toasts, show, remove }
})
