# romsuperior ai

Portable source snapshot prepared for migration away from AppDeploy.

## Current status

This repository contains the current romsuperior ai frontend and backend source as a migration baseline. The AppDeploy-specific adapters are intentionally preserved in this first snapshot so the working app remains reproducible while we replace them in the next migration step.

## Features in the current baseline

- AI chat with FAST/DEEP reasoning modes
- bounded Agent mode with public web-page browsing
- web research mode
- image generation
- image vision/file workflows
- voice input and speech output
- local chat history
- authenticated cloud chat history
- separate Manager console

## Migration rules

- Never commit API keys, passwords, owner secrets, OAuth secrets, or `.env` files.
- AppDeploy remains the backup deployment until the independent deployment is verified.
- Next step: replace `@appdeploy/client` and `@appdeploy/sdk` with portable HTTP/auth/database adapters.

## Run the frontend

```bash
npm install
npm run dev
```

The current source is a migration baseline, not yet the final AppDeploy-free build.