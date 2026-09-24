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
  /** Opcional: cómo la nombró el negocio, para distinguirla si tiene más de una cuenta. */
  alias?: string | null
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
