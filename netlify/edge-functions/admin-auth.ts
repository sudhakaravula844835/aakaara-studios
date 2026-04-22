import type { Config, Context } from "https://edge.netlify.com";

const COOKIE_NAME = "aakaara_admin_session";
const LOGIN_PAGE = "/admin/login.html";
const LOGIN_ACTION = "/admin/login";
const LOGOUT_ACTION = "/admin/logout";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function env(name: string): string {
  return Netlify.env.get(name)?.trim() || "";
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64Url(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function getCookie(req: Request, name: string): string {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function cookieHeader(value: string, maxAge = SESSION_TTL_SECONDS): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/admin",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

function redirect(url: URL, status = 303, cookie?: string): Response {
  const headers = new Headers({
    location: url.toString(),
    "cache-control": "no-store",
  });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status, headers });
}

function authSetupError(): Response {
  return new Response("Admin authentication is not configured.", {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function withAdminHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function createSession(secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

async function isValidSession(req: Request, secret: string): Promise<boolean> {
  const value = getCookie(req, COOKIE_NAME);
  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [expiresText, nonce, signature] = parts;
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  if (!nonce || nonce.length < 8) return false;

  const payload = `${expiresText}.${nonce}`;
  return constantTimeEqual(signature, await hmac(payload, secret));
}

function loginUrl(reqUrl: URL, error = false): URL {
  const next = `${reqUrl.pathname}${reqUrl.search}`;
  const url = new URL(LOGIN_PAGE, reqUrl.origin);
  if (next !== LOGIN_PAGE) url.searchParams.set("next", next);
  if (error) url.searchParams.set("error", "1");
  return url;
}

function safeNext(reqUrl: URL, formValue: FormDataEntryValue | null): URL {
  const fallback = new URL("/admin/quote-generator.html", reqUrl.origin);
  if (typeof formValue !== "string" || !formValue.startsWith("/admin/")) return fallback;
  const next = new URL(formValue, reqUrl.origin);
  if ([LOGIN_PAGE, LOGIN_ACTION, LOGOUT_ACTION].includes(next.pathname)) return fallback;
  return next;
}

function failedLoginUrl(reqUrl: URL, nextUrl: URL): URL {
  const url = new URL(LOGIN_PAGE, reqUrl.origin);
  url.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
  url.searchParams.set("error", "1");
  return url;
}

export default async (req: Request, context: Context) => {
  const reqUrl = new URL(req.url);
  const passwordHash = env("AAKAARA_ADMIN_PASSWORD_HASH");
  const sessionSecret = env("AAKAARA_ADMIN_SESSION_SECRET");

  if (!passwordHash || !sessionSecret) return authSetupError();

  if (reqUrl.pathname === LOGOUT_ACTION) {
    return redirect(new URL(LOGIN_PAGE, reqUrl.origin), 303, cookieHeader("", 0));
  }

  if (reqUrl.pathname === LOGIN_ACTION && req.method === "POST") {
    const form = await req.formData();
    const submittedPassword = String(form.get("password") || "");
    const submittedHash = await sha256(submittedPassword);
    const nextUrl = safeNext(reqUrl, form.get("next"));

    if (constantTimeEqual(submittedHash, passwordHash.toLowerCase())) {
      const session = await createSession(sessionSecret);
      return redirect(nextUrl, 303, cookieHeader(session));
    }

    return redirect(failedLoginUrl(reqUrl, nextUrl), 303, cookieHeader("", 0));
  }

  if (reqUrl.pathname === LOGIN_PAGE) {
    if (await isValidSession(req, sessionSecret)) {
      return redirect(new URL("/admin/quote-generator.html", reqUrl.origin));
    }
    return withAdminHeaders(await context.next());
  }

  if (!(await isValidSession(req, sessionSecret))) {
    if (req.method === "GET") return redirect(loginUrl(reqUrl));
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return withAdminHeaders(await context.next());
};

export const config: Config = {
  path: "/admin/*",
  onError: "fail",
};
