import type {
  ClienteAuthVerifyResponse,
  ClienteCheckResponse,
  ClienteResolveResponse,
  CrearOrderPayload,
  OrderCreada,
  PreparePaymentPublicPayload,
  PreparePaymentPublicResponse,
  PublicPaymentMethod,
  PublicProducto,
  PublicProfile,
  TransactionPublic,
} from '~/types'

export function usePublicTienda() {
  const auth = usePublicApi('auth')
  const apotheca = usePublicApi('apotheca')
  const collector = usePublicApi('collector')

  return {
    getProfile: (slug: string) =>
      auth.get<PublicProfile>(`/public/profiles/${slug}`),

    getProductos: (profileId: string) =>
      apotheca.get<PublicProducto[]>(`/public/profiles/${profileId}/productos`),

    crearOrder: (profileId: string, payload: CrearOrderPayload) =>
      apotheca.post<OrderCreada>(`/public/profiles/${profileId}/orders`, payload),

    checkCliente: (profileId: string, identificacion: string) =>
      apotheca.get<ClienteCheckResponse>(`/public/profiles/${profileId}/clientes/check`, { identificacion }),

    resolverCliente: (profileId: string, identificacion: string, verificationId: string) =>
      apotheca.get<ClienteResolveResponse>(`/public/profiles/${profileId}/clientes/resolve`, { identificacion, verification_id: verificationId }),

    solicitarCodigoCliente: (email: string, recaptchaToken?: string) =>
      auth.post<{ message: string }>('/public/cliente-auth/request-code', { email, recaptchaToken }),

    verificarCodigoCliente: (email: string, code: string) =>
      auth.post<ClienteAuthVerifyResponse>('/public/cliente-auth/verify-code', { email, code }),

    vincularTransaccion: (orderId: string, transactionId: string) =>
      apotheca.patch<OrderCreada>(`/public/orders/${orderId}/transaction`, { transaction_id: transactionId }),

    getPaymentMethods: (profileId: string) =>
      collector.get<PublicPaymentMethod[]>(`/public/profiles/${profileId}/payment-methods`),

    prepararPago: (profileId: string, paymentMethodId: string, payload: PreparePaymentPublicPayload) =>
      collector.post<PreparePaymentPublicResponse>(`/public/profiles/${profileId}/payment-methods/${paymentMethodId}/prepare`, payload),

    subirComprobante: (transactionId: string, comprobanteBase64: string, mimeType: string) =>
      collector.post<TransactionPublic>(`/public/transactions/${transactionId}/comprobante`, {
        comprobante_base64: comprobanteBase64,
        mime_type: mimeType,
      }),
  }
}
