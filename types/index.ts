export interface ApiResponse<T> {
  data: T
}

export interface PublicProfile {
  id: string
  name: string
  url_name: string
  type: string
}

export interface PublicProducto {
  id: string
  sku: string
  name: string
  description: string | null
  category: string
  unit: string
  sale_price: number
  stock: number
  image_principal: string | null
  image_2: string | null
  image_3: string | null
  image_4: string | null
  video_url: string | null
}

export const TIPOS_IDENTIFICACION = [
  { value: '05', label: 'Cédula' },
  { value: '04', label: 'RUC' },
  { value: '06', label: 'Pasaporte' },
] as const

export interface CarritoLinea {
  producto_id: string
  cantidad: number
}

export interface CrearOrderPayload {
  cliente: {
    nombre: string
    tipo_identificacion: string
    identificacion: string
    email: string
    telefono?: string
  }
  items: CarritoLinea[]
  verification_id?: string
}

export interface OrderCreada {
  id: string
  status: string
  subtotal: number
  total: number
  items: { producto_id: string, nombre: string, cantidad: number, precio_unitario: number }[]
}

export type GatewayType = 'payphone' | 'payphone_split' | 'bank' | 'effective'

export interface BankConfigurationData {
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  titular: string
  identificacion: string
  email_notificacion?: string | null
}

export interface PublicPaymentMethod {
  id: string
  gateway_type: GatewayType
  configuration_data: BankConfigurationData | null
  /** Solo en payphone_split: si el negocio activó que el cliente pague la comisión de Payphone. */
  recargo_habilitado?: boolean
  /** Porcentaje del recargo cuando recargo_habilitado es true (ej. 5.75) — null si está apagado. */
  recargo_porcentaje?: number | null
}

export interface PreparePaymentPublicPayload {
  amount: number
  reference_id: string
  url_return_reference?: string
  recaptchaToken?: string
}

export interface PreparePaymentPublicResponse {
  transaction_id: string
  status?: string
  configuration_data?: BankConfigurationData
  pay_with_card?: string | null
  pay_with_payphone?: string | null
}

export interface TransactionPublic {
  id: string
  status: string
}

export interface ClienteCheckResponse {
  exists: boolean
  requiere_verificacion: boolean
  email_hint?: string | null
}

export interface ClienteAuthVerifyResponse {
  verification_id: string
  cliente_auth_id: string
  email: string
  expires_at: string
}

export interface ClienteResolveResponse {
  exists: boolean
  razon_social?: string
  telefono?: string | null
  email?: string | null
}
