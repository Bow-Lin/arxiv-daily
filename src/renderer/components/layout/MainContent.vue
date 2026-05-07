<template>
  <main class="main-content">
    <slot />
  </main>
</template>

<style scoped>
.main-content {
  flex: 0 1 480px;
  min-width: 300px;
  overflow: hidden;
  background: #ffffff;
}
</style>
