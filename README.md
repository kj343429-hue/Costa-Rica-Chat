# Costa Rica Chat 🇨🇷

A practice chatbot for Spanish students. Students role-play everyday situations
in Costa Rica with characters who speak Costa Rican Spanish (usted, mae, pura vida, diay…).

## Scenarios
- 🍛 Ordering food at a soda (live now)

Ideas for later: 🥭 feria del agricultor, 🚌 bus to San José, 🏪 pulpería.

## How it works
Students use a web page hosted on Netlify. A Netlify Function sends their messages
to an AI model. The API key is kept in Netlify's environment variables and never
in this repository.

## Files
- `public/index.html`: the page students see (scenario cards and chat)
- `netlify/functions/chat.mjs`: the server code that holds each character's instructions and calls OpenAI
- `netlify.toml`, `package.json`: settings Netlify uses to build the site

## Setup on Netlify
1. Netlify → **Add new site → Import an existing project → GitHub** → choose this repository.
2. Leave the build settings as they are and deploy.
3. **Site configuration → Environment variables → Add a variable**: key `OPENAI_API_KEY`, value = your key from platform.openai.com.
   Optional: `OPENAI_MODEL` to use a different model (default `gpt-6.2-sol`).
4. **Deploys → Trigger deploy** so the key takes effect.

Set a monthly spending limit in the OpenAI dashboard so costs stay predictable.

## Planned next
- Firebase Authentication for student/teacher login
- Firestore database to save conversations for teacher review
