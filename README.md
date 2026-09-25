# romsuperior ai

Portable source for the romsuperior ai service, being migrated away from AppDeploy.

## Migration status

**Step 2 complete:** the application source no longer imports `@appdeploy/client` or `@appdeploy/sdk`.

The independent stack is now:

- React + Vite frontend
- Vercel-compatible serverless API
- Supabase Auth + Postgres for accounts and cloud chat history
- Gemini API for chat, multimodal analysis, research/agent workflows, and image generation

AppDeploy remains untouched as the backup until the independent deployment is tested.

## Features carried forward

- AI chat with FAST/DEEP modes
- vision/image attachments
- bounded web research and Agent mode
- image generation
- voice input and speech output
- local chat history
- authenticated cloud chat history
- separate Manager planned as its own service

## Required environment variables

Copy `.env.example` into your deployment settings. Never commit real secrets.

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `GEMINI_FAST_MODEL`
- `GEMINI_DEEP_MODEL`
- `GEMINI_IMAGE_MODEL`

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor to create the protected chat table and Row Level Security policies.

## Local development

```bash
npm install
npm run dev
```

## Deployment

The repository includes `vercel.json` for a Vercel deployment. Supabase can remain on its Free plan for small projects; Gemini has a free API tier for supported models, subject to quotas and model availability.
