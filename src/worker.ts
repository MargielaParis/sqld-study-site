import localContent from "./generated/content";

const SESSION_COOKIE = "sqld_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type ManifestItem = {
  slug: string;
  title: string;
  section: string;
  sourcePath: string;
  kind: "doc" | "asset";
  summary?: string;
  language?: string;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      return login(request, env);
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return jsonResponse({ ok: true }, { "Set-Cookie": clearSessionCookie() });
    }

    if (url.pathname === "/api/auth/session" && request.method === "GET") {
      return jsonResponse({ authenticated: await hasValidSession(request, env) });
    }

    if (url.pathname.startsWith("/api/")) {
      if (!(await hasValidSession(request, env))) {
        return jsonResponse({ error: "인증이 필요합니다." }, {}, 401);
      }
      return api(request, env, url);
    }

    return serveApp(request, env);
  }
};

async function login(request: Request, env: Env) {
  const password = env.SQLD_SITE_PASSWORD;
  if (!password) {
    return jsonResponse({ error: "사이트 비밀번호가 아직 설정되지 않았습니다." }, {}, 503);
  }

  const limit = await checkRateLimit(request, env);
  if (!limit.allowed) {
    return jsonResponse(
      { error: "잠시 후 다시 시도해 주세요." },
      { "Retry-After": String(limit.retryAfter) },
      429
    );
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const candidate = typeof body?.password === "string" ? body.password : "";
  const valid = await constantTimeEqual(await sha256(candidate), await sha256(password));

  if (!valid) {
    return jsonResponse({ error: "비밀번호가 올바르지 않습니다." }, {}, 401);
  }

  await clearRateLimit(request, env);
  const session = await createSession(password);
  return jsonResponse(
    { ok: true },
    { "Set-Cookie": sessionCookie(session) }
  );
}

async function api(request: Request, env: Env, url: URL) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "읽기 전용 API입니다." }, {}, 405);
  }

  if (url.pathname === "/api/manifest") {
    return jsonResponse(await getJson(env.SQLD_DOCS, "manifest", localContent.manifest));
  }

  if (url.pathname === "/api/search") {
    return jsonResponse(await getJson(env.SQLD_DOCS, "search", localContent.manifest));
  }

  if (url.pathname === "/api/practice") {
    return jsonResponse(await getJson(env.SQLD_DOCS, "practice", localContent.practice));
  }

  const documentMatch = url.pathname.match(/^\/api\/doc\/(.+)$/);
  if (documentMatch) {
    const slug = decodeSegment(documentMatch[1]);
    const fallback = localContent.docs[slug as keyof typeof localContent.docs];
    const document = await getJson(env.SQLD_DOCS, `doc/${slug}`, fallback);
    return document ? jsonResponse(document) : jsonResponse({ error: "문서를 찾을 수 없습니다." }, {}, 404);
  }

  const assetMatch = url.pathname.match(/^\/api\/asset\/(.+)$/);
  if (assetMatch) {
    const slug = decodeSegment(assetMatch[1]);
    const fallback = localContent.assets[slug as keyof typeof localContent.assets];
    const asset = await getJson(env.SQLD_DOCS, `asset/${slug}`, fallback);
    return asset ? jsonResponse(asset) : jsonResponse({ error: "코드 파일을 찾을 수 없습니다." }, {}, 404);
  }

  return jsonResponse({ error: "API 경로를 찾을 수 없습니다." }, {}, 404);
}

async function serveApp(request: Request, env: Env) {
  if (!env.ASSETS) {
    return new Response("정적 자산 바인딩이 없습니다.", { status: 500 });
  }

  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return noStoreHtml(response);

  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = "/index.html";
  return noStoreHtml(await env.ASSETS.fetch(new Request(fallbackUrl, request)));
}

function noStoreHtml(response: Response) {
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function hasValidSession(request: Request, env: Env) {
  const password = env.SQLD_SITE_PASSWORD;
  if (!password) return false;

  const value = getCookie(request, SESSION_COOKIE);
  if (!value) return false;

  const [payload, signature] = value.split(".");
  const [expiresAt, fingerprint] = payload?.split("|") ?? [];
  if (!payload || !signature || !expiresAt || !fingerprint) return false;
  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;

  const currentFingerprint = await sha256(password);
  if (!(await constantTimeEqual(fingerprint, currentFingerprint))) return false;

  const expectedSignature = await hmac(payload, password);
  return constantTimeEqual(signature, expectedSignature);
}

async function createSession(password: string) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${expiresAt}|${await sha256(password)}`;
  const signature = await hmac(payload, password);
  return `${payload}.${signature}`;
}

function sessionCookie(value: string) {
  return `${SESSION_COOKIE}=${value}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function getCookie(request: Request, name: string) {
  const cookies = request.headers.get("Cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

async function checkRateLimit(request: Request, env: Env) {
  if (!env.SQLD_DOCS) return { allowed: true, retryAfter: 0 };

  const key = await rateLimitKey(request);
  const now = Date.now();
  const record = await env.SQLD_DOCS.get<RateLimitRecord>(key, "json");
  if (!record || record.resetAt <= now) {
    await env.SQLD_DOCS.put(key, JSON.stringify({ count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 }), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS
    });
    return { allowed: true, retryAfter: 0 };
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((record.resetAt - now) / 1000)) };
  }

  await env.SQLD_DOCS.put(key, JSON.stringify({ ...record, count: record.count + 1 }), {
    expirationTtl: Math.max(1, Math.ceil((record.resetAt - now) / 1000))
  });
  return { allowed: true, retryAfter: 0 };
}

async function clearRateLimit(request: Request, env: Env) {
  if (env.SQLD_DOCS) await env.SQLD_DOCS.delete(await rateLimitKey(request));
}

async function rateLimitKey(request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") || "local-client";
  return `auth-rate/${await sha256(ip)}`;
}

async function getJson<T>(kv: KVNamespace | undefined, key: string, fallback: T): Promise<T> {
  if (!kv) return fallback;
  try {
    return (await kv.get<T>(key, "json")) ?? fallback;
  } catch {
    return fallback;
  }
}

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(signature);
}

function base64Url(buffer: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
