import {createClient} from '@sanity/client'

export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? 'ylubxokd',
  dataset: process.env.SANITY_DATASET ?? 'production',
  apiVersion: '2025-05-08',
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
})
