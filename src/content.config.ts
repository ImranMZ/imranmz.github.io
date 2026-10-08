import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    url: z.string().optional(),
    order: z.number(),
  }),
})

const certs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/certs' }),
  schema: z.object({
    name: z.string(),
    org: z.string(),
    date: z.string(),
    order: z.number(),
  }),
})

export const collections = { projects, certs }
