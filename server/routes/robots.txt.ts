export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  setHeader(event, 'Content-Type', 'text/plain')
  return [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${config.public.siteUrl}/sitemap.xml`,
  ].join('\n')
})
