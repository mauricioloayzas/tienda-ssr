<script setup lang="ts">
import { TIPOS_IDENTIFICACION } from '~/types'
import type { PreparePaymentPublicResponse, PublicPaymentMethod, PublicProducto } from '~/types'

const route = useRoute()
const config = useRuntimeConfig()
const slug = route.params.slug as string
const tienda = usePublicTienda()
const { getToken } = useRecaptcha()

const { data: profileRes } = await useAsyncData(`profile-${slug}`, () =>
  tienda.getProfile(slug).catch(() => null)
)
const profile = computed(() => profileRes.value?.data ?? null)

if (!profile.value) {
  throw createError({ statusCode: 404, statusMessage: 'No encontramos esta tienda' })
}

const canonicalUrl = `${config.public.siteUrl}/tienda/${slug}`

useSeoMeta({
  title: `Tienda — ${profile.value.name}`,
  description: `Compra en línea los productos de ${profile.value.name}.`,
  ogTitle: `Tienda — ${profile.value.name}`,
  ogDescription: `Compra en línea los productos de ${profile.value.name}.`,
  ogType: 'website',
  ogUrl: canonicalUrl,
  twitterCard: 'summary',
})
useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: profile.value.name,
      url: canonicalUrl,
    }),
  }],
})

const { data: productosRes, pending: loadingProductos } = await useAsyncData(`productos-${profile.value.id}`, () =>
  tienda.getProductos(profile.value!.id).catch(() => ({ data: [] as PublicProducto[] }))
)
const productos = computed(() => productosRes.value?.data ?? [])

type Step = 'catalogo' | 'carrito' | 'contacto' | 'pago' | 'success'
const volviendoDePayphone = route.query.pago === 'ok'
const step = ref<Step>(volviendoDePayphone ? 'success' : 'catalogo')
const submitError = ref('')
const submitting = ref(false)

// --- Carrito: Map producto_id -> cantidad ---
const carrito = reactive<Record<string, number>>({})

const lineasCarrito = computed(() =>
  Object.entries(carrito)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([productoId, cantidad]) => {
      const producto = productos.value.find(p => p.id === productoId)
      return producto ? { producto, cantidad } : null
    })
    .filter((l): l is { producto: PublicProducto, cantidad: number } => l !== null)
)
const totalItemsCarrito = computed(() => lineasCarrito.value.reduce((s, l) => s + l.cantidad, 0))
const totalCarrito = computed(() => lineasCarrito.value.reduce((s, l) => s + l.producto.sale_price * l.cantidad, 0))

function cantidadEnCarrito(productoId: string): number {
  return carrito[productoId] ?? 0
}

function agregarAlCarrito(producto: PublicProducto) {
  const actual = carrito[producto.id] ?? 0
  if (actual >= producto.stock) return
  carrito[producto.id] = actual + 1
}

function cambiarCantidad(productoId: string, delta: number) {
  const producto = productos.value.find(p => p.id === productoId)
  const actual = carrito[productoId] ?? 0
  const nueva = Math.max(0, Math.min(actual + delta, producto?.stock ?? actual + delta))
  carrito[productoId] = nueva
}

function quitarDelCarrito(productoId: string) {
  carrito[productoId] = 0
}

// --- Detalle / galería ---
const detalleProducto = ref<PublicProducto | null>(null)
const galeriaIndex = ref(0)

interface MediaItem { tipo: 'imagen' | 'video', url: string }
const galeriaMedia = computed<MediaItem[]>(() => {
  if (!detalleProducto.value) return []
  const p = detalleProducto.value
  const items: MediaItem[] = []
  for (const url of [p.image_principal, p.image_2, p.image_3, p.image_4]) {
    if (url) items.push({ tipo: 'imagen', url })
  }
  if (p.video_url) items.push({ tipo: 'video', url: p.video_url })
  return items
})

function abrirDetalle(p: PublicProducto) {
  detalleProducto.value = p
  galeriaIndex.value = 0
}
function cerrarDetalle() {
  detalleProducto.value = null
}
function mediaSiguiente() {
  galeriaIndex.value = (galeriaIndex.value + 1) % galeriaMedia.value.length
}
function mediaAnterior() {
  galeriaIndex.value = (galeriaIndex.value - 1 + galeriaMedia.value.length) % galeriaMedia.value.length
}

// --- Contacto ---
const nombreContacto = ref('')
const telefonoContacto = ref('')
const email = ref('')
const tipoIdentificacion = ref('05')
const identificacion = ref('')
const aceptaTerminos = ref(false)

// --- Pedido ---
const orderId = ref('')
const orderTotal = ref(0)

async function crearOrderFinal() {
  submitError.value = ''
  if (!lineasCarrito.value.length) {
    submitError.value = 'Tu carrito está vacío.'
    return
  }
  if (!nombreContacto.value || !email.value || !identificacion.value) {
    submitError.value = 'Completa tu nombre, email e identificación.'
    return
  }
  if (!aceptaTerminos.value) {
    submitError.value = 'Debes aceptar los Términos y la Política de Privacidad para continuar.'
    return
  }

  submitting.value = true
  try {
    const res = await tienda.crearOrder(profile.value!.id, {
      cliente: {
        nombre: nombreContacto.value,
        tipo_identificacion: tipoIdentificacion.value,
        identificacion: identificacion.value,
        email: email.value,
        telefono: telefonoContacto.value || undefined,
      },
      items: lineasCarrito.value.map(l => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    })
    orderId.value = res.data.id
    orderTotal.value = res.data.total
    step.value = 'pago'
    await cargarMetodosPago()
  } catch (e: unknown) {
    submitError.value = (e as { data?: { error?: string } })?.data?.error || 'No pudimos registrar tu pedido. Intenta de nuevo.'
  } finally {
    submitting.value = false
  }
}

// --- Pago (idéntico al de booking-ssr, ver usePublicTienda) ---
const paymentMethods = ref<PublicPaymentMethod[]>([])
const loadingPaymentMethods = ref(false)
const metodoSeleccionado = ref<PublicPaymentMethod | null>(null)
const pagoError = ref('')
const pagoLoading = ref(false)
const bankTransaction = ref<PreparePaymentPublicResponse | null>(null)
const comprobanteBase64 = ref('')
const comprobanteMimeType = ref('')
const comprobanteFileName = ref('')
const successMensaje = ref('')

const gatewayLabels: Record<string, string> = {
  bank: 'Transferencia bancaria',
  payphone: 'Tarjeta (Payphone)',
  payphone_split: 'Tarjeta (Payphone)',
  effective: 'Efectivo contra entrega',
}

// Un negocio puede tener más de una cuenta bancaria — todas caían acá con la misma
// etiqueta genérica ("Transferencia bancaria"), indistinguibles entre sí antes de elegir.
// Se distinguen mostrando el nombre del banco (+ los últimos 4 dígitos, por si dos
// cuentas son del mismo banco).
function paymentOptionLabel(pm: PublicPaymentMethod): string {
  if (pm.gateway_type === 'bank' && pm.configuration_data) {
    const { banco, numero_cuenta } = pm.configuration_data
    const ultimos4 = numero_cuenta ? numero_cuenta.slice(-4) : ''
    return banco ? `Transferencia — ${banco}${ultimos4 ? ` ****${ultimos4}` : ''}` : gatewayLabels.bank!
  }
  return gatewayLabels[pm.gateway_type] ?? pm.gateway_type
}

async function cargarMetodosPago() {
  loadingPaymentMethods.value = true
  try {
    const res = await tienda.getPaymentMethods(profile.value!.id)
    paymentMethods.value = res.data ?? []
  } catch {
    paymentMethods.value = []
  } finally {
    loadingPaymentMethods.value = false
  }
}

function terminarSinPago(mensaje: string) {
  successMensaje.value = mensaje
  step.value = 'success'
}

async function elegirMetodo(pm: PublicPaymentMethod) {
  pagoError.value = ''
  metodoSeleccionado.value = pm

  if (pm.gateway_type === 'effective') {
    terminarSinPago('Tu pedido quedó registrado. Paga contra entrega.')
    return
  }

  if (pm.gateway_type === 'payphone' || pm.gateway_type === 'payphone_split') {
    await pagarConPayphone(pm)
  } else if (pm.gateway_type === 'bank') {
    await generarDatosBancarios()
  }
}

async function pagarConPayphone(pm: PublicPaymentMethod) {
  pagoLoading.value = true
  pagoError.value = ''
  try {
    const recaptchaToken = await getToken('preparar_pago_publico')
    const returnUrl = `${window.location.origin}${window.location.pathname}?pago=ok`
    const res = await tienda.prepararPago(profile.value!.id, pm.id, {
      amount: orderTotal.value,
      reference_id: orderId.value,
      url_return_reference: returnUrl,
      recaptchaToken,
    })
    // Vincular acá — no espera al redirect de vuelta — dispara la factura automática
    // (ver link-transaction-public.php en apotheca): v1 de la tienda solo soporta el
    // camino de pago con tarjeta como señal de confirmación.
    await tienda.vincularTransaccion(orderId.value, res.data.transaction_id).catch(() => {})
    if (res.data.pay_with_card) {
      window.location.href = res.data.pay_with_card
    } else {
      pagoError.value = 'No pudimos iniciar el pago con Payphone. Intenta de nuevo.'
    }
  } catch (e: unknown) {
    pagoError.value = (e as { data?: { error?: string } })?.data?.error || 'No pudimos iniciar el pago. Intenta de nuevo.'
  } finally {
    pagoLoading.value = false
  }
}

async function generarDatosBancarios() {
  if (!metodoSeleccionado.value) return
  pagoLoading.value = true
  pagoError.value = ''
  try {
    const recaptchaToken = await getToken('preparar_pago_publico')
    const res = await tienda.prepararPago(profile.value!.id, metodoSeleccionado.value.id, {
      amount: orderTotal.value,
      reference_id: orderId.value,
      recaptchaToken,
    })
    bankTransaction.value = res.data
  } catch (e: unknown) {
    pagoError.value = (e as { data?: { error?: string } })?.data?.error || 'No pudimos generar los datos de pago. Intenta de nuevo.'
  } finally {
    pagoLoading.value = false
  }
}

function onComprobanteChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  comprobanteFileName.value = file.name
  comprobanteMimeType.value = file.type
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    comprobanteBase64.value = result.split(',')[1] ?? ''
  }
  reader.readAsDataURL(file)
}

async function handleSubirComprobante() {
  if (!bankTransaction.value || !comprobanteBase64.value) return
  pagoLoading.value = true
  pagoError.value = ''
  try {
    await tienda.subirComprobante(bankTransaction.value.transaction_id, comprobanteBase64.value, comprobanteMimeType.value)
    // Transferencia/efectivo con comprobante: revisión manual, no dispara factura
    // automática en v1 (ver link-transaction-public.php) — el negocio la confirma a mano.
    await tienda.vincularTransaccion(orderId.value, bankTransaction.value.transaction_id).catch(() => {})
    terminarSinPago('Recibimos tu comprobante. El negocio lo revisará y confirmará tu pedido.')
  } catch (e: unknown) {
    pagoError.value = (e as { data?: { error?: string } })?.data?.error || 'No pudimos subir el comprobante. Intenta de nuevo.'
  } finally {
    pagoLoading.value = false
  }
}

function volver() {
  if (step.value === 'carrito') step.value = 'catalogo'
  else if (step.value === 'contacto') step.value = 'carrito'
}
</script>

<template>
  <div class="navbar">
    <div class="container navbar-inner">
      <span class="brand">{{ profile!.name }}</span>
      <button
        v-if="step === 'catalogo'"
        class="cart-button"
        type="button"
        @click="step = totalItemsCarrito ? 'carrito' : 'catalogo'"
      >
        🛒 Carrito
        <span v-if="totalItemsCarrito" class="cart-badge">{{ totalItemsCarrito }}</span>
      </button>
    </div>
  </div>

  <main class="container">
    <h1>Tienda online</h1>
    <p>{{ profile!.name }}</p>

    <button v-if="step === 'carrito' || step === 'contacto'" class="btn btn-back" type="button" @click="volver">
      ← Atrás
    </button>

    <!-- Catálogo -->
    <div v-if="step === 'catalogo'">
      <div v-if="loadingProductos" class="state-container"><p>Cargando productos…</p></div>
      <div v-else-if="!productos.length" class="state-container">
        <div class="state-icon">📦</div>
        <p>Este negocio todavía no tiene productos disponibles en la tienda.</p>
      </div>
      <div v-else class="product-grid" style="margin-top:16px;">
        <div v-for="p in productos" :key="p.id" class="product-card">
          <button type="button" class="product-image-btn" @click="abrirDetalle(p)">
            <img v-if="p.image_principal" :src="p.image_principal" :alt="p.name" class="product-image">
            <span v-else class="product-image placeholder">📦</span>
          </button>
          <span class="name">{{ p.name }}</span>
          <span v-if="p.description" class="desc">{{ p.description }}</span>
          <span class="price">${{ p.sale_price.toFixed(2) }}</span>
          <span class="stock">{{ p.stock }} disponibles</span>
          <button class="btn-link" type="button" @click="abrirDetalle(p)">Ver detalle</button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="cantidadEnCarrito(p.id) >= p.stock"
            @click="agregarAlCarrito(p)"
          >
            {{ cantidadEnCarrito(p.id) > 0 ? `En el carrito (${cantidadEnCarrito(p.id)})` : 'Agregar' }}
          </button>
        </div>
      </div>

      <button
        v-if="totalItemsCarrito"
        class="btn btn-primary"
        style="margin-top:20px; position:sticky; bottom:16px;"
        type="button"
        @click="step = 'carrito'"
      >
        Ver carrito ({{ totalItemsCarrito }}) · ${{ totalCarrito.toFixed(2) }}
      </button>
    </div>

    <!-- Carrito -->
    <div v-else-if="step === 'carrito'" class="card">
      <div class="step-label">Tu carrito</div>
      <div v-if="!lineasCarrito.length" class="state-container">
        <p>Tu carrito está vacío.</p>
        <button class="btn btn-outline" style="margin-top:12px;" type="button" @click="step = 'catalogo'">Ver productos</button>
      </div>
      <template v-else>
        <div v-for="l in lineasCarrito" :key="l.producto.id" class="cart-item">
          <div class="info">
            <div class="name">{{ l.producto.name }}</div>
            <div class="price">${{ l.producto.sale_price.toFixed(2) }} c/u</div>
          </div>
          <div class="qty-control">
            <button class="qty-btn" type="button" @click="cambiarCantidad(l.producto.id, -1)">−</button>
            <span class="qty-value">{{ l.cantidad }}</span>
            <button class="qty-btn" type="button" :disabled="l.cantidad >= l.producto.stock" @click="cambiarCantidad(l.producto.id, 1)">+</button>
          </div>
          <button class="remove" type="button" @click="quitarDelCarrito(l.producto.id)">Quitar</button>
        </div>

        <div class="summary-row" style="margin-top:10px; font-size:16px;">
          <span class="label">Total</span>
          <span class="value">${{ totalCarrito.toFixed(2) }}</span>
        </div>

        <button class="btn btn-primary" style="margin-top:14px;" type="button" @click="step = 'contacto'">
          Continuar
        </button>
      </template>
    </div>

    <!-- Contacto -->
    <div v-else-if="step === 'contacto'" class="card">
      <div class="step-label">Tus datos</div>
      <div v-if="submitError" class="alert-error">{{ submitError }}</div>
      <div class="field">
        <label for="nombre">Nombre completo</label>
        <input id="nombre" v-model="nombreContacto" type="text">
      </div>
      <div class="field">
        <label for="telefono">Teléfono</label>
        <input id="telefono" v-model="telefonoContacto" type="tel">
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required>
      </div>
      <div class="field">
        <label for="tipo-identificacion">Tipo de identificación</label>
        <select id="tipo-identificacion" v-model="tipoIdentificacion">
          <option v-for="t in TIPOS_IDENTIFICACION" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div class="field">
        <label for="identificacion">Número de {{ TIPOS_IDENTIFICACION.find(t => t.value === tipoIdentificacion)?.label.toLowerCase() }}</label>
        <input id="identificacion" v-model="identificacion" type="text">
      </div>

      <div class="card" style="background: var(--gray-50); margin-top: 0;">
        <div v-for="l in lineasCarrito" :key="l.producto.id" class="summary-row">
          <span class="label">{{ l.producto.name }} × {{ l.cantidad }}</span>
          <span class="value">${{ (l.producto.sale_price * l.cantidad).toFixed(2) }}</span>
        </div>
        <div class="summary-row" style="font-weight:700;">
          <span class="label">Total</span>
          <span class="value">${{ totalCarrito.toFixed(2) }}</span>
        </div>
      </div>

      <div class="consent-check">
        <input id="acepta-terminos" v-model="aceptaTerminos" type="checkbox">
        <label for="acepta-terminos">
          Acepto los <a href="https://www.mauloasan.com/terms" target="_blank" rel="noopener">Términos y Condiciones</a>
          y la <a href="https://www.mauloasan.com/privacy" target="_blank" rel="noopener">Política de Privacidad</a>.
        </label>
      </div>

      <button class="btn btn-primary" style="margin-top:14px;" type="button" :disabled="submitting" @click="crearOrderFinal">
        {{ submitting ? 'Guardando…' : 'Continuar al pago' }}
      </button>
    </div>

    <!-- Pago -->
    <div v-else-if="step === 'pago'" class="card">
      <div class="step-label">Método de pago</div>
      <p style="margin-bottom: 14px;">Tu pedido quedó registrado. Elige cómo quieres pagar.</p>
      <div v-if="pagoError" class="alert-error">{{ pagoError }}</div>

      <div v-if="loadingPaymentMethods" class="state-container"><p>Cargando…</p></div>

      <div v-else-if="!paymentMethods.length" class="state-container">
        <p>Este negocio todavía no tiene métodos de pago en línea configurados.</p>
        <button class="btn btn-primary" style="margin-top:12px;" type="button" @click="terminarSinPago('Tu pedido quedó registrado. El negocio se pondrá en contacto para coordinar el pago.')">
          Continuar
        </button>
      </div>

      <template v-else>
        <div v-if="!metodoSeleccionado" class="option-list">
          <button
            v-for="pm in paymentMethods"
            :key="pm.id"
            class="option-btn"
            type="button"
            :disabled="pagoLoading"
            @click="elegirMetodo(pm)"
          >
            {{ paymentOptionLabel(pm) }}
          </button>
        </div>

        <div v-else-if="metodoSeleccionado.gateway_type === 'payphone' || metodoSeleccionado.gateway_type === 'payphone_split'" class="state-container">
          <p>{{ pagoLoading ? 'Redirigiendo a Payphone…' : 'Preparando el pago…' }}</p>
        </div>

        <div v-else-if="metodoSeleccionado.gateway_type === 'bank'">
          <div v-if="pagoLoading && !bankTransaction" class="state-container"><p>Generando datos de pago…</p></div>
          <div v-else-if="bankTransaction" class="card" style="background: var(--gray-50); margin-top: 0;">
            <div class="summary-row"><span class="label">Banco</span><span class="value">{{ bankTransaction.configuration_data?.banco }}</span></div>
            <div class="summary-row"><span class="label">Tipo de cuenta</span><span class="value">{{ bankTransaction.configuration_data?.tipo_cuenta }}</span></div>
            <div class="summary-row"><span class="label">Número de cuenta</span><span class="value">{{ bankTransaction.configuration_data?.numero_cuenta }}</span></div>
            <div class="summary-row"><span class="label">Titular</span><span class="value">{{ bankTransaction.configuration_data?.titular }}</span></div>
            <div class="summary-row"><span class="label">Identificación</span><span class="value">{{ bankTransaction.configuration_data?.identificacion }}</span></div>
            <div class="summary-row"><span class="label">Monto a transferir</span><span class="value">${{ orderTotal.toFixed(2) }}</span></div>

            <div class="field" style="margin-top: 14px;">
              <label for="comprobante">Sube tu comprobante de transferencia</label>
              <input id="comprobante" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" @change="onComprobanteChange">
            </div>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="pagoLoading || !comprobanteBase64"
              @click="handleSubirComprobante"
            >
              {{ pagoLoading ? 'Subiendo…' : 'Ya transferí, subir comprobante' }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Éxito -->
    <div v-else-if="step === 'success'" class="card confirmation">
      <div class="icon">✅</div>
      <h2>¡Listo!</h2>
      <p v-if="successMensaje">{{ successMensaje }}</p>
      <p v-else-if="volviendoDePayphone">Tu pago fue procesado. {{ profile!.name }} preparará tu pedido.</p>
    </div>

    <!-- Galería de detalle -->
    <div v-if="detalleProducto" class="gallery-overlay" @click.self="cerrarDetalle">
      <div class="gallery-modal">
        <button type="button" class="gallery-close" @click="cerrarDetalle">✕</button>
        <div class="gallery-media">
          <button v-if="galeriaMedia.length > 1" type="button" class="gallery-nav prev" @click="mediaAnterior">‹</button>
          <template v-if="galeriaMedia.length">
            <img
              v-if="galeriaMedia[galeriaIndex]!.tipo === 'imagen'"
              :src="galeriaMedia[galeriaIndex]!.url"
              :alt="detalleProducto.name"
              class="gallery-img"
            >
            <video v-else :src="galeriaMedia[galeriaIndex]!.url" controls class="gallery-img" />
          </template>
          <div v-else class="product-image placeholder" style="width:100%; height:280px;">📦</div>
          <button v-if="galeriaMedia.length > 1" type="button" class="gallery-nav next" @click="mediaSiguiente">›</button>
        </div>
        <div v-if="galeriaMedia.length > 1" class="gallery-dots">
          <span v-for="(m, i) in galeriaMedia" :key="i" class="gallery-dot" :class="{ active: i === galeriaIndex }" @click="galeriaIndex = i" />
        </div>
        <div class="gallery-info">
          <h2>{{ detalleProducto.name }}</h2>
          <p v-if="detalleProducto.description">{{ detalleProducto.description }}</p>
          <p class="price" style="font-size:20px; color:var(--gray-900); margin-top:8px;">${{ detalleProducto.sale_price.toFixed(2) }}</p>
          <button
            class="btn btn-primary"
            style="margin-top:12px;"
            type="button"
            :disabled="cantidadEnCarrito(detalleProducto.id) >= detalleProducto.stock"
            @click="agregarAlCarrito(detalleProducto)"
          >
            {{ cantidadEnCarrito(detalleProducto.id) > 0 ? `En el carrito (${cantidadEnCarrito(detalleProducto.id)})` : 'Agregar al carrito' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
