const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "access-control-allow-methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=300" },
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
        return new Response(body, {
          status: response.status,
          headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "public, max-age=300" },
        });
      }
      lastStatus = response.status;
      lastMessage = response.status >= 500 ? "TMDB is temporarily unavailable." : "TMDB rejected the catalogue request.";
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastStatus = 504;
      lastMessage = error instanceof DOMException && error.name === "AbortError"
        ? "TMDB catalogue request timed out."
        : "TMDB catalogue request failed.";
    } finally {
      clearTimeout(timeout);
    }
  }

  return json({ error: lastMessage, upstreamStatus: lastStatus }, lastStatus === 429 ? 429 : 502);
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const token = Deno.env.get("TMDB_READ_ACCESS_TOKEN") ?? "";
  if (!token) return json({ error: "TMDB catalogue is not configured." }, 503);

  const incoming = new URL(request.url);
  const path = incoming.searchParams.get("path") ?? "";
  if (!allowedPath(path)) return json({ error: "Unsupported TMDB catalogue path." }, 400);

  const upstream = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [key, value] of incoming.searchParams) {
    if (blockedParams.has(key.toLowerCase()) || value.length > 200) continue;
    upstream.searchParams.append(key, value);
  }

  return fetchTmdb(upstream, token);
});
