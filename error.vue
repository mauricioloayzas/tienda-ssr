<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
  }
}>()

useSeoMeta({ title: props.error.statusCode === 404 ? 'No encontrado' : 'Error', robots: 'noindex' })

const handleError = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="navbar">
    <div class="container">
      <span class="brand">Clichín</span>
    </div>
  </div>
  <main class="container">
    <div class="state-container">
      <div class="state-icon">🔍</div>
      <h2>{{ error.statusCode === 404 ? 'No encontramos esta tienda' : 'Ocurrió un error' }}</h2>
      <p>{{ error.statusMessage || error.message || 'Intenta de nuevo en unos minutos.' }}</p>
      <button class="btn btn-outline" style="margin-top:16px;" @click="handleError">
        Volver al inicio
      </button>
    </div>
  </main>
</template>
