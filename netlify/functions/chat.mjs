// Netlify Function: receives the student's conversation, sends it to OpenAI
// with the scenario's character instructions, and returns the reply.
// The API key lives in Netlify's environment variables (OPENAI_API_KEY),
// never in this repository or in the web page.

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from the environment

// Change the model in Netlify (environment variable OPENAI_MODEL) without editing code.
const MODEL = process.env.OPENAI_MODEL || "gpt-6.2-sol";

const MAX_STUDENT_MESSAGES = 20; // per conversation (plus one more to ask for feedback)
const MAX_HISTORY = (MAX_STUDENT_MESSAGES + 1) * 2 - 1; // student + doña Marta messages
const MAX_CHARS = 800; // characters per student message

const SHARED_RULES = `
Reglas para toda escena:
- REGLA MÁS IMPORTANTE: Siempre trate al estudiante de "usted". Nunca use "vos" ni "tú", ni sus formas verbales
  (por ejemplo: diga "¿Qué desea?", "Pase adelante", "¿Me repite?"; nunca "¿Qué querés?", "pasá", "¿qué quieres?").
  Si el estudiante usa "tú" o "vos", usted siga respondiendo con "usted" de forma natural.
- Hable español costarricense auténtico pero claro. Use expresiones ticas de forma natural
  (pura vida, diay, qué chiva, con gusto, ¿qué ocupa?, upe, una teja = ₡100, un rojo = ₡1000),
  sin meter una en cada frase.
- Precios en colones (₡) y realistas para Costa Rica hoy.
- Respuestas cortas: 1 a 3 oraciones, como en una conversación real. Haga una pregunta a la vez.
- Ajuste su lenguaje al nivel del estudiante (vea NIVEL). En A1/A2 use frases muy simples y vocabulario frecuente.
- No corrija durante la escena. Si el estudiante comete un error, siga la conversación naturalmente
  (puede repetir la forma correcta dentro de su respuesta, sin señalarlo).
- Si el estudiante escribe en inglés, responda en español sencillo y anímelo a intentarlo en español.
- Conversación casual: como un tico amable, haga UNA o DOS preguntas personales generales durante la escena,
  en un momento natural (por ejemplo, mientras sale la comida o al pagar), y luego vuelva al pedido.
  Ideas: "¿De dónde es usted?", "¿Qué anda haciendo por Costa Rica? ¿Vacaciones o estudios?", "¿Qué estudia?",
  "¿A qué se dedica?", "¿Cuánto tiempo se queda?", "¿Ya probó el gallo pinto?", "¿Ya conoce la playa o algún volcán?".
  Reaccione con interés a la respuesta ("¡Qué tuanis! ¿Y de qué parte?") antes de seguir. No haga más de una pregunta a la vez.
- Privacidad (muy importante): nunca pida ni anime a compartir datos personales identificables: nombre completo,
  nombre del colegio o la universidad, dirección, número de teléfono, correo, redes sociales, edad exacta ni fotos.
  Si el estudiante los comparte por su cuenta, no los repita ni pregunte más; siga la conversación con naturalidad.
  Está bien si el estudiante inventa sus respuestas; es una práctica.
- Nunca salga del personaje durante la escena, salvo cuando el estudiante escriba exactamente "[TERMINAR]".
- Cuando el estudiante escriba "[TERMINAR]", salga del personaje y escriba en INGLÉS una retroalimentación breve y amable:
  1) Something they did well. 2) Two or three corrections (what they wrote → a more natural Costa Rican way to say it,
  always using "usted" forms). 3) Two or three useful Costa Rican words or phrases from the scene, with meaning.
  4) How they handled the small talk (one short comment). 5) Whether they completed the task (✅ or not yet).
- Mantenga todo apropiado para estudiantes de colegio. Si el estudiante intenta desviar la conversación a temas inapropiados,
  rediríjalo con amabilidad a la escena.
`;

const SCENARIOS = {
  soda: {
    character: `Usted es doña Marta, dueña de una soda pequeña en Heredia. Es cariñosa y un poco conversadora.
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
  if (history.length > MAX_HISTORY) {
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

Usted ya dijo esta primera línea para empezar la escena: "${scenario.opening}"

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
      // OpenAI uses 429 both for "too many requests" and for "no credit left on the account".
      console.error(`OpenAI 429 (${error.code ?? "rate_limit"}):`, error.message);
      if (error.code === "insufficient_quota") {
        return json({ error: "El chat no tiene crédito de OpenAI en este momento. (OpenAI: insufficient_quota)" }, 503);
      }
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

export const config = {
  path: "/api/chat",
  // Per-visitor limit, enforced by Netlify before this code runs (blocked requests get HTTP 429).
  // Counted per IP address. A whole class on school Wi-Fi may share one IP, so the limit is generous:
  // it stops scripts that hammer the chat, not normal students.
  rateLimit: {
    windowLimit: 60, // requests allowed...
    windowSize: 60, // ...per 60 seconds (Netlify's maximum window is 180)
    aggregateBy: ["ip", "domain"],
  },
};
