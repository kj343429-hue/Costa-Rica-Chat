// Netlify Function: receives the student's conversation, sends it to OpenAI
// with the scenario's character instructions, and returns the reply.
// The API key lives in Netlify's environment variables (OPENAI_API_KEY),
// never in this repository or in the web page.

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from the environment

// Change the model in Netlify (environment variable OPENAI_MODEL) without editing code.
const MODEL = process.env.OPENAI_MODEL || "gpt-6.2-sol";

const MAX_TURNS = 40; // messages per conversation
const MAX_CHARS = 800; // characters per student message

const SHARED_RULES = `
Reglas para toda escena:
- Hablás español costarricense auténtico pero claro. Usá expresiones ticas de forma natural
  (pura vida, mae entre amigos, diay, tuanis, qué chiva, con gusto, ¿qué ocupa?, upe, al chile, una teja = ₡100, un rojo = ₡1000),
  sin meter una en cada frase.
- Con clientes y personas desconocidas usás "usted", como se hace en Costa Rica. Si el estudiante usa "tú", respondé natural con "usted".
- Precios en colones (₡) y realistas para Costa Rica hoy.
- Respuestas cortas: 1 a 3 oraciones, como en una conversación real. Hacé una pregunta a la vez.
- Ajustá tu lenguaje al nivel del estudiante (ver NIVEL). En A1/A2 usá frases muy simples y vocabulario frecuente.
- No corrijás durante la escena. Si el estudiante comete un error, seguí la conversación naturalmente
  (podés repetir la forma correcta dentro de tu respuesta, sin señalarlo).
- Si el estudiante escribe en inglés, respondé en español sencillo y animalo a intentarlo en español.
- Nunca salgás del personaje durante la escena, salvo cuando el estudiante escriba exactamente "[TERMINAR]".
- Cuando el estudiante escriba "[TERMINAR]", salí del personaje y escribí en INGLÉS una retroalimentación breve y amable:
  1) Something they did well. 2) Two or three corrections (what they wrote → a more natural Costa Rican way to say it).
  3) Two or three useful Costa Rican words or phrases from the scene, with meaning.
  4) Whether they completed the task (✅ or not yet).
- Mantené todo apropiado para estudiantes de colegio. Si el estudiante intenta desviar la conversación a temas inapropiados,
  redirigilo con amabilidad a la escena.
`;

const SCENARIOS = {
  soda: {
    character: `Sos doña Marta, dueña de una soda pequeña en Heredia. Sos cariñosa y un poco conversadora.
Menú del día: casado (con pollo, carne en salsa, pescado o vegetariano, ₡3500), gallo pinto con huevo (₡2500),
olla de carne (₡3800), arroz con pollo (₡3200), empanadas de queso o de frijol (₡900).
Frescos naturales: cas, mora, piña, tamarindo (₡1000). Café chorreado (₡800). Salsa Lizano en todas las mesas.
Meta del estudiante: saludar, pedir comida y bebida, preguntar algo del menú, pedir la cuenta y pagar.`,
    opening: "¡Buenas! Pase adelante, siéntese donde guste. ¿Qué le sirvo hoy?",
  },
};

const LEVELS = {
  A1: "NIVEL A1 (principiante): frases de 5 a 8 palabras, presente, vocabulario muy básico.",
  A2: "NIVEL A2: frases cortas y claras, presente y pasado simple, vocabulario cotidiano.",
  B1: "NIVEL B1: conversación natural a velocidad moderada, algo de vocabulario tico extra.",
  B2: "NIVEL B2: conversación natural como con cualquier tico, con modismos frecuentes.",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const scenario = SCENARIOS[body.scenario];
  const level = LEVELS[body.level] ?? LEVELS.A2;
  const history = Array.isArray(body.messages) ? body.messages : null;

  if (!scenario || !history || history.length === 0) {
    return json({ error: "Invalid request" }, 400);
  }
  if (history.length > MAX_TURNS) {
    return json({ error: "Esta conversación ya es muy larga. Empiece una nueva escena." }, 400);
  }

  // Only accept plain text turns that alternate correctly, starting and ending with the student.
  const messages = [];
  for (const [i, m] of history.entries()) {
    const expectedRole = i % 2 === 0 ? "user" : "assistant";
    if (m?.role !== expectedRole || typeof m.content !== "string" || !m.content.trim()) {
      return json({ error: "Invalid request" }, 400);
    }
    if (m.role === "user" && m.content.length > MAX_CHARS) {
      return json({ error: `Mensaje muy largo (máximo ${MAX_CHARS} caracteres).` }, 400);
    }
    messages.push({ role: m.role, content: m.content });
  }
  if (messages.at(-1).role !== "user") return json({ error: "Invalid request" }, 400);

  // The character's opening line is shown in the page; tell the model it already said it.
  const system = `${scenario.character}

Ya dijiste esta primera línea para empezar la escena: "${scenario.opening}"

${level}
${SHARED_RULES}`;

  try {
    const response = await client.responses.create({
      model: MODEL,
      instructions: system,
      input: messages,
    });

    const reply = (response.output_text || "").trim();

    return json({ reply: reply || "Perdón, ¿me repite, por favor?" });
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      console.error("Invalid or missing OPENAI_API_KEY");
      return json({ error: "The chatbot isn't set up yet (API key missing)." }, 500);
    }
    if (error instanceof OpenAI.RateLimitError) {
      return json({ error: "Muchas personas están usando el chat. Intente de nuevo en un momento." }, 429);
    }
    if (error instanceof OpenAI.APIError) {
      console.error(`OpenAI API error ${error.status}:`, error.message);
      return json({ error: "Algo salió mal. Intente de nuevo." }, 502);
    }
    console.error(error);
    return json({ error: "Algo salió mal. Intente de nuevo." }, 500);
  }
};

export const config = { path: "/api/chat" };
