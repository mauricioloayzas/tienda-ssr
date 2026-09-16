declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

export function useRecaptcha() {
  const config = useRuntimeConfig()
  const siteKey = config.public.recaptchaSiteKey as string

  function loadScript(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    if (document.getElementById('recaptcha-script')) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'recaptcha-script'
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('No se pudo cargar reCAPTCHA'))
      document.head.appendChild(script)
    })
  }

  async function getToken(action: string): Promise<string> {
    if (!siteKey) return ''
    await loadScript()
    return new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action }).then(resolve).catch(reject)
      })
    })
  }

  return { getToken }
}
