import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  title: string
  body: string
  type: 'success' | 'info' | 'error'
  removing: boolean
}

let nextId = 0

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  function show(title: string, body: string, type: 'success' | 'info' | 'error' = 'info') {
    const id = nextId++
    toasts.value.push({ id, title, body, type, removing: false })
    setTimeout(() => remove(id), 3000)
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
