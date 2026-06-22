import { timingSafeEqual } from "node:crypto";

/**
 * Editorial access control.
 *
 * Every privileged endpoint (anything that can expose author names, emails,
 * institutions, titles, or the manuscript files themselves) must be guarded by
 * a bearer token that matches the EDITOR_TOKEN environment variable.
 *
 * Set EDITOR_TOKEN in the Netlify site environment. If it is not configured,
 * access is denied outright so the data can never be served unprotected.
 */

function getEditorToken(): string | undefined {
  // process.env is populated by Netlify for both build and runtime.
  const fromProcess = process.env.EDITOR_TOKEN;
  if (fromProcess && fromProcess.length > 0) return fromProcess;

  // Fallback for the Netlify runtime global, if present.
  try {
    // @ts-ignore - Netlify global is not always typed in this project.
    const fromNetlify = typeof Netlify !== "undefined" ? Netlify.env.get("EDITOR_TOKEN") : undefined;
    if (fromNetlify && fromNetlify.length > 0) return fromNetlify;
  } catch {
    /* ignore */
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Returns true when the request carries a valid `Authorization: Bearer <token>`
 * header matching EDITOR_TOKEN. Returns false when the token is missing,
 * malformed, mismatched, or when EDITOR_TOKEN is not configured.
 */
export function isEditorAuthorized(req: Request): boolean {
  const expected = getEditorToken();
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const presented = match[1].trim();
  if (!presented) return false;

  return safeEqual(presented, expected);
}

/**
 * Standard 401 response for unauthenticated access to a protected endpoint.
 */
export function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized. A valid editorial bearer token is required." }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="editorial"',
      },
    }
  );
}
