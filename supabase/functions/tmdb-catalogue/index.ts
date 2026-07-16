const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": status >= 400 ? "no-store" : "public, max-age=300",
    },
  });

const allowedPath = (path: string) =>
  path === "/genre/movie/list" ||
  path === "/discover/movie" ||
  path === "/search/movie" ||
  /^\/movie\/\d+\/(credits|videos|external_ids)$/.test(path);

const blockedParams = new Set(["api_key", "authorization", "access_token", "path"]);

const fetchTmdb = async (url: URL, token: string) => {
  let lastStatus = 502;
  let lastMessage = "TMDB did not respond.";
  let lastDetails = "The upstream request did not complete.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      const body = await response.text();
      if (response.ok) {
        try {
          const data = JSON.parse(body);
          return json({ ok: true, source: "tmdb", ...data }, response.status);
        } catch {
          return json({ ok: false, error: "TMDB returned invalid JSON.", details: "The upstream response could not be parsed." }, 502);
        }
      }
      lastStatus = response.status;
      lastMessage = response.status >= 500 ? "TMDB is temporarily unavailable." : "TMDB rejected the catalogue request.";
      lastDetails = `TMDB returned HTTP ${response.status}.`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastStatus = 504;
      lastMessage = error instanceof DOMException && error.name === "AbortError"
        ? "TMDB catalogue request timed out."
        : "TMDB catalogue request failed.";
      lastDetails = error instanceof DOMException && error.name === "AbortError"
        ? "The upstream request exceeded 12 seconds."
        : "The upstream network request failed.";
    } finally {
      clearTimeout(timeout);
    }
  }

  const status = lastStatus === 429 ? 429 : lastStatus >= 400 && lastStatus < 500 ? 400 : 502;
  return json({ ok: false, error: lastMessage, details: lastDetails, upstreamStatus: lastStatus }, status);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed." }, 405);

  const token = Deno.env.get("TMDB_READ_ACCESS_TOKEN") ?? "";
  if (!token) return json({ ok: false, error: "TMDB catalogue is not configured." }, 503);

  const incoming = new URL(request.url);
  const path = incoming.searchParams.get("path") ?? "";
  if (!allowedPath(path)) return json({ ok: false, error: "Unsupported TMDB catalogue path." }, 400);
  if (path === "/search/movie" && !(incoming.searchParams.get("query") ?? "").trim()) {
    return json({ ok: false, error: "A movie search query is required." }, 400);
  }

  const upstream = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of incoming.searchParams) {
    if (blockedParams.has(key.toLowerCase()) || value.length > 200) continue;
    upstream.searchParams.append(key, value);
  }

  return fetchTmdb(upstream, token);
});
