export default defineNuxtConfig({
  ssr: true,
  compatibilityDate: '2025-07-15',

  nitro: {
    preset: 'aws-lambda',
  },

  css: ['~/assets/css/main.css'],

  app: {
    cdnURL: process.env.NUXT_APP_CDN_URL ?? '',
    head: {
      htmlAttrs: { lang: 'es' },
      titleTemplate: (title) => title ? `${title} — Clichín` : 'Clichín — Tienda online',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiAuthBase: process.env.NUXT_PUBLIC_API_AUTH_BASE || '',
      apiApothecaBase: process.env.NUXT_PUBLIC_API_APOTHECA_BASE || '',
      apiCollectorBase: process.env.NUXT_PUBLIC_API_COLLECTOR_BASE || '',
      recaptchaSiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://tienda.clichin.app',
    },
  },
})
