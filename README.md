# Kinora

An interactive Hugo cinema platform for emotional movie discovery, upcoming releases, personal film writing, audience research, and community memories.

## Run locally

```sh
cd /Users/mohamad_ros/Desktop/Wb-design/cinema-digital-age
hugo server
```

Open <http://localhost:1313> and keep the terminal running.

## Connect TMDB

The site works immediately with curated fallback movies. To enable live mood recommendations, upcoming releases, online search, genres, posters, ratings, and trailers:

1. Create a TMDB account and request an API Read Access Token.
2. Log in to the Supabase CLI and link the Kinora project.
3. Store the token as a Supabase Edge Function secret:

```sh
npx supabase@latest secrets set TMDB_READ_ACCESS_TOKEN="YOUR_TMDB_READ_ACCESS_TOKEN"
npx supabase@latest functions deploy tmdb-catalogue --no-verify-jwt
```

The GitHub Pages frontend calls the public `tmdb-catalogue` Edge Function using the Supabase publishable key. The Edge Function adds the private TMDB bearer token on the server. Never add the TMDB token to `hugo.toml`, frontend JavaScript, or GitHub Pages output.

## Customize content

- Journal entries: `content/journal/*.md`
- Interview results: `content/interviews/_index.md`
- About and author details: `content/about/_index.md` and `hugo.toml`
- Curated movie fallbacks and mood logic: `assets/js/main.js`
- Design system: `assets/css/main.css`
- Cinema photographs: `static/images/`

Journal entries support `categories` and `tags` in TOML front matter. The homepage search and category controls update automatically.

## Community submissions

The forms include Netlify Forms attributes. When deployed to Netlify, submissions appear under the project’s **Forms** area. During local development, mood feedback and community memories are stored in browser `localStorage` so the interactions remain testable.

## Deploy

The included `netlify.toml` runs the Hugo production build and publishes `public/`. Before connecting a custom domain, set the final `baseURL` in `hugo.toml`.

```sh
hugo --minify
```
