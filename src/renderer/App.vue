<template>
  <div class="app">
    <router-view />
  </div>
</template>

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
</style>
