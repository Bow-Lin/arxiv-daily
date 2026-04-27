<template>
  <div class="spinner" :class="{ inline: inline, small: small }">
    <div class="spinner-circle"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  inline?: boolean
  small?: boolean
}>()
</script>

<style scoped>
.spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.spinner.inline {
  padding: 0;
  display: inline-flex;
}

.spinner.small {
  padding: 8px;
}

.spinner-circle {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8e8;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small .spinner-circle {
  width: 16px;
  height: 16px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
