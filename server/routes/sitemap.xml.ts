interface PublicProfile {
  url_name: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  setHeader(event, 'Content-Type', 'application/xml')

  let profiles: PublicProfile[] = []
  try {
    const res = await $fetch<{ data: PublicProfile[] }>(`${config.public.apiAuthBase}/public/profiles`)
    profiles = res.data ?? []
  } catch {
    profiles = []
  }

  const urls = profiles
    .map(p => `  <url><loc>${config.public.siteUrl}/tienda/${p.url_name}</loc><changefreq>weekly</changefreq></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
})
