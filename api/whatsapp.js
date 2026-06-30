// Webhook de WhatsApp Cloud API.
// - GET  -> verificacion del webhook por parte de Meta (hub.challenge).
// - POST -> mensaje entrante (firmado por Meta): se valida la firma, se pasa a
//           Claude y se devuelve la respuesta por WhatsApp.
//
// Variables de entorno requeridas (configurar en Vercel, nunca hardcodear):
//   VERIFY_TOKEN       token arbitrario que tambien cargas en el panel de Meta
//   APP_SECRET         "App Secret" de la app de Meta (firma X-Hub-Signature-256)
//   ANTHROPIC_API_KEY  API key de Anthropic
//   PHONE_NUMBER_ID    ID del numero de telefono de WhatsApp Business
//   WHATSAPP_TOKEN     token de acceso de la Graph API
//
// Runtime: Node.js (fetch nativo, Node 18+).

import crypto from "node:crypto";

// Desactivamos el body parser de Vercel: necesitamos los bytes crudos del body
// para poder validar la firma HMAC que manda Meta. Parsear y re-serializar
// cambiaria los bytes y la firma nunca coincidiria.
export const config = {
  api: { bodyParser: false },
};

const GRAPH_API_VERSION = "v21.0";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB: los webhooks de WhatsApp son chicos.
const MAX_USER_CHARS = 4096; // limite de un mensaje de texto de WhatsApp.

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
  const params = new URL(req.url, "http://localhost").searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && safeEqual(token, process.env.VERIFY_TOKEN)) {
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(challenge ?? "");
  }

  return res.status(403).send("Forbidden");
}

// --- POST: mensaje entrante ---
async function handleIncomingMessage(req, res) {
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(413).send("Payload Too Large");
  }

  // Puerta de entrada: solo procesamos requests autenticamente firmados por Meta.
  const signature = req.headers["x-hub-signature-256"];
  if (!verifySignature(rawBody, signature, process.env.APP_SECRET)) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const body = JSON.parse(rawBody.toString("utf8"));
    const message = extractTextMessage(body);

    // Sin mensaje de texto (status update, reaccion, audio, etc.): cortar.
    if (message) {
      const reply = await askClaude(message.text);
      await sendWhatsAppMessage(message.from, reply);
    }
  } catch (err) {
    // Logueamos pero igual devolvemos 200: el request era legitimo (firma valida),
    // no queremos que Meta reintente indefinidamente.
    console.error("Error procesando el webhook de WhatsApp:", err?.message || err);
  }

  return res.status(200).end();
}

// --- Helpers de seguridad ---

// Lee el body como Buffer crudo, con tope de tamano para evitar abuso de memoria.
async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("payload too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Verifica X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(APP_SECRET, rawBody).
// Comparacion en tiempo constante para no filtrar la firma byte a byte.
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || typeof signatureHeader !== "string") {
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);

  return (
    received.length === computed.length &&
    crypto.timingSafeEqual(received, computed)
  );
}

// Comparacion de strings en tiempo constante (para el verify_token).
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// --- Logica de mensajes ---

// Devuelve { from, text } si hay un mensaje de texto, o null en cualquier otro caso.
function extractTextMessage(body) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text" || !message.text?.body) {
    return null;
  }

  return {
    from: message.from,
    text: String(message.text.body).slice(0, MAX_USER_CHARS),
  };
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
