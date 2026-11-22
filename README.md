# Costa Rica Chat 🇨🇷

A practice chatbot for Spanish students. Students role-play everyday situations
in Costa Rica with characters who speak Costa Rican Spanish (usted, mae, pura vida, diay…).

## Planned scenarios
- 🍛 Ordering food at a soda
- 🥭 Shopping at a feria del agricultor
- 🚌 Taking the bus to San José
- 🏪 Buying something at a pulpería

## How it works
Students use a web page hosted on Netlify. A Netlify Function sends their messages
to an AI model. The API key is kept in Netlify's environment variables and never
in this repository.

## Files
- `public/index.html`: the page students see (scenario cards and chat)
- `netlify/functions/chat.mjs`: the server code that holds each character's instructions and calls Claude
- `netlify.toml`, `package.json`: settings Netlify uses to build the site

## Setup on Netlify
1. Netlify → **Add new site → Import an existing project → GitHub** → choose this repository.
2. Leave the build settings as they are and deploy.
3. **Site configuration → Environment variables → Add a variable**: key `ANTHROPIC_API_KEY`, value = your key from console.anthropic.com.
4. **Deploys → Trigger deploy** so the key takes effect.

Set a monthly spending limit in the Anthropic Console so costs stay predictable.
