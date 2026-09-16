import type { ApiResponse } from '~/types'

type PublicService = 'auth' | 'apotheca' | 'collector'

export function usePublicApi(service: PublicService) {
  const config = useRuntimeConfig()

  const baseUrl =
    service === 'apotheca' ? config.public.apiApothecaBase :
    service === 'collector' ? config.public.apiCollectorBase :
    config.public.apiAuthBase

  async function get<T>(endpoint: string, query?: Record<string, string>): Promise<ApiResponse<T>> {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
    return await $fetch<ApiResponse<T>>(`${baseUrl}${endpoint}${qs}`)
  }

  async function post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return await $fetch<ApiResponse<T>>(`${baseUrl}${endpoint}`, {
      method: 'POST',
      body: body as Record<string, unknown>,
    })
  }

  async function patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return await $fetch<ApiResponse<T>>(`${baseUrl}${endpoint}`, {
      method: 'PATCH',
      body: body as Record<string, unknown>,
    })
  }

  return { get, post, patch }
}
