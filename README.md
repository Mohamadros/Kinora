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
2. Open `hugo.toml`.
3. Set `params.tmdbToken`:

```toml
tmdbToken = "YOUR_TMDB_READ_ACCESS_TOKEN"
```

The token is used by browser JavaScript and is therefore visible to visitors. For a serious public deployment, move the API calls into a Netlify Function and store the token as an environment variable.

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
