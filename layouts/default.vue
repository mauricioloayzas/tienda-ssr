<template>
  <div class="app-shell">
    <div class="app-content">
      <slot />
    </div>
    <footer class="site-footer">
      clichin.app y webapp.clichin.app son propiedad de
      <a href="https://www.mauloasan.com" target="_blank" rel="noopener">Mauloasan</a>,
      quien posee todos los derechos de uso y autoría.
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
}

.site-footer {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--gray-400);
}

.site-footer a {
  color: var(--gray-500);
}
</style>
