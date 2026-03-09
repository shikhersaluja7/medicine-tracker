// src/services/ocr.service.ts — Reads prescription label photos using AI.
//
// Think of this like a very smart assistant who can look at a photo of a
// prescription bottle and type out all the important details for you.
// You hand them the photo; they hand you back a filled-in form.
//
// The "AI" here is Claude (claude-haiku-4-5), a model made by Anthropic.
// We send it a picture; it sends back the medicine name, dosage, and
// instructions as text we can paste straight into the add-medicine form.

import type { AddMedicineInput } from "@/db/schema";

// ─── Error types ──────────────────────────────────────────────────────────────
// Three named error classes so the calling screen can show exactly the right
// message for each situation — like different coloured warning labels on a box.

// Thrown when the device cannot reach the internet.
// e.g., airplane mode, no Wi-Fi, no mobile data.
export class NetworkError extends Error {
  constructor() {
    super("NetworkError");
    this.name = "NetworkError";
  }
}

// Thrown when the Anthropic API returns a non-OK HTTP status.
// e.g., 401 = bad API key, 429 = rate limit hit, 500 = server problem.
export class APIError extends Error {
  constructor(public status: number) {
    super(`APIError: ${status}`);
    this.name = "APIError";
  }
}

// Thrown when the API reply doesn't contain recognisable medicine details.
// e.g., the image was blurry, or showed a grocery receipt instead of a label.
export class ParseError extends Error {
  constructor() {
    super("ParseError");
    this.name = "ParseError";
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
// The instruction we give Claude when we hand it the image.
// We ask for JSON so the reply is machine-readable, not a paragraph of prose.
// Returning ONLY JSON (no extra words) makes parsing reliable.
const SYSTEM_PROMPT = `You are a prescription label reader. Given a photo of a prescription label or medicine packaging, extract the following fields and return ONLY a JSON object with no extra text:

{
  "name": "medicine name (string, required)",
  "dosage": "strength and form e.g. 10mg tablet (string, required)",
  "instructions": "how and when to take it e.g. Take one tablet twice daily with food (string or null)",
  "doctor": "prescribing doctor name e.g. Dr. Smith (string or null)"
}

If you cannot find a required field, use an empty string. If you cannot find an optional field, use null. Return only the JSON object, nothing else.`;

// ─── scanPrescription ─────────────────────────────────────────────────────────
// Sends a base64-encoded image to the Claude API and returns parsed form fields.
//
// Like mailing a photo to a specialist and getting a typed report back:
//   You send:  base64 image string (the photo)
//   You get:   { name, dosage, instructions, doctor } (the filled-in form)
//
// Parameters:
//   imageBase64 — the image as a base64 string (no "data:image/..." prefix)
//   mimeType    — "image/jpeg" or "image/png" so Claude knows the format
//
// Throws NetworkError, APIError, or ParseError — never returns partial data.
export async function scanPrescription(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<AddMedicineInput> {
  // The API key is read from the environment at runtime.
  // It is never hardcoded — it lives in the developer's local .env file.
  // e.g., "sk-ant-api03-..."
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";

  // ── Step 1: Call the Claude API ──────────────────────────────────────────
  // We use fetch (built into React Native) rather than an SDK to keep the
  // dependency list small. fetch works like sending a letter to a web service
  // and waiting for its reply.
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // x-api-key authenticates us to Anthropic — like showing your library card.
        "x-api-key": apiKey,
        // anthropic-version tells the API which version of its contract to follow.
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // claude-haiku-4-5 is the fastest and cheapest Claude model — ideal for OCR.
        model: "claude-haiku-4-5-20251001",
        // max_tokens caps how long the reply can be. 512 is plenty for a JSON object.
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                // "image" content block — tells Claude to look at a picture.
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: "Please read this prescription label and extract the medicine details.",
              },
            ],
          },
        ],
      }),
    });
  } catch {
    // fetch itself threw an exception — this means the network is unreachable.
    // The device has no internet connection.
    throw new NetworkError();
  }

  // ── Step 2: Check the API accepted our request ───────────────────────────
  if (!response.ok) {
    // The server replied with an error status code.
    // We pass the status number so it can appear in logs for debugging.
    throw new APIError(response.status);
  }

  // ── Step 3: Read Claude's reply ──────────────────────────────────────────
  const json = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  // Claude's text reply lives inside json.content[0].text.
  // We use optional chaining (?.) to safely handle an unexpected shape.
  const rawText = json.content?.[0]?.text ?? "";

  // ── Step 4: Extract the JSON object from Claude's reply ──────────────────
  // Claude sometimes wraps its answer in markdown code fences like:
  //   ```json
  //   { "name": "Aspirin", ... }
  //   ```
  // The regex \{[\s\S]*\} matches the first { ... } block, skipping any fences.
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new ParseError();
  }

  // ── Step 5: Parse and validate the extracted JSON ────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // The matched text looked like JSON but wasn't valid — treat as unreadable.
    throw new ParseError();
  }

  // Type guard: confirm the parsed value is a plain object, not an array or primitive.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ParseError();
  }

  const obj = parsed as Record<string, unknown>;

  // Extract name and dosage — required fields.
  // Default to empty string if Claude couldn't find them so the user can type them in.
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const dosage = typeof obj.dosage === "string" ? obj.dosage.trim() : "";

  // Extract optional fields — use undefined (not null) so they map cleanly
  // to the AddMedicineInput interface's optional properties.
  const instructions =
    typeof obj.instructions === "string" && obj.instructions.trim()
      ? obj.instructions.trim()
      : undefined;

  const doctor =
    typeof obj.doctor === "string" && obj.doctor.trim()
      ? obj.doctor.trim()
      : undefined;

  // If both required fields are empty, the image was completely unreadable.
  // Better to throw now than return a useless empty form.
  if (!name && !dosage) {
    throw new ParseError();
  }

  return { name, dosage, instructions, doctor };
}
