# Guide de Déploiement

## Secrets GitHub (5 required)
1. CLOUDFLARE_API_TOKEN
2. CLOUDFLARE_ACCOUNT_ID
3. GEMINI_API_KEY
4. YOUTUBE_API_KEY
5. GUMROAD_API_KEY

## Cloudflare KV
wrangler kv:namespace create QUIZZES
wrangler kv:namespace create USERS

## Gumroad
Products: quiz-pro, quiz-music, music-course
Webhook: https://quizify-backend.YOUR_ACCOUNT.workers.dev/api/gumroad/webhook