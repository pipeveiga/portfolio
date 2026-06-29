// Webhook de WhatsApp Cloud API.
// - GET  -> verificacion del webhook por parte de Meta (hub.challenge).
// - POST -> mensaje entrante: se lo paso a Claude y devuelvo la respuesta por WhatsApp.
//
// Variables de entorno requeridas (configurar en Vercel, nunca hardcodear):
//   VERIFY_TOKEN       token arbitrario que tambien cargas en el panel de Meta
//   ANTHROPIC_API_KEY  API key de Anthropic
//   PHONE_NUMBER_ID    ID del numero de telefono de WhatsApp Business
//   WHATSAPP_TOKEN     token de acceso de la Graph API
//
// Runtime: Node.js (fetch nativo, Node 18+).

const GRAPH_API_VERSION = "v21.0";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT =
  "Sos el asistente de atencion al cliente de mi negocio. Respondes por WhatsApp, " +
  "asi que se claro, amable y conciso. Contesta siempre en el idioma del cliente " +
  "(por defecto, espanol). Si no sabes algo o excede lo que podes resolver, decilo " +
  "con honestidad y ofrece derivar la consulta a una persona del equipo.";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleVerification(req, res);
  }

  if (req.method === "POST") {
    return handleIncomingMessage(req, res);
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).send("Method Not Allowed");
}

// --- GET: verificacion del webhook (Meta) ---
function handleVerification(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
}

// --- POST: mensaje entrante ---
async function handleIncomingMessage(req, res) {
  try {
    const message = extractTextMessage(req.body);

    // Sin mensaje de texto (status update, reaccion, audio, etc.): cortar.
    if (!message) {
      return res.status(200).end();
    }

    const reply = await askClaude(message.text);
    await sendWhatsAppMessage(message.from, reply);
  } catch (err) {
    // Logueamos pero igual devolvemos 200: no queremos que Meta reintente.
    console.error("Error procesando el webhook de WhatsApp:", err);
  }

  return res.status(200).end();
}

// Devuelve { from, text } si hay un mensaje de texto, o null en cualquier otro caso.
function extractTextMessage(body) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text" || !message.text?.body) {
    return null;
  }

  return { from: message.from, text: message.text.body };
}

// Manda el texto del usuario a la API de Anthropic y devuelve la respuesta de Claude.
async function askClaude(userText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((block) => block.type === "text");

  return (
    textBlock?.text?.trim() ||
    "Perdon, no pude generar una respuesta en este momento. Probemos de nuevo en un rato."
  );
}

// Envia un mensaje de texto al remitente via Graph API.
async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Graph API ${response.status}: ${detail}`);
  }
}
