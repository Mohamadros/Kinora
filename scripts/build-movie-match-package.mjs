import fs from 'node:fs/promises';

const token = process.env.TMDB_TOKEN;
if (!token) {
  console.error('TMDB_TOKEN is required.');
  process.exit(1);
}

const genreNames = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime', 99:'Documentary',
  18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History', 27:'Horror', 10402:'Music',
  9648:'Mystery', 10749:'Romance', 878:'Science Fiction', 10770:'TV Movie', 53:'Thriller',
  10752:'War', 37:'Western'
};
const apiBase = 'https://api.themoviedb.org/3';
const today = new Date().toISOString().slice(0, 10);
const base = { include_adult:'false', 'primary_release_date.lte':today };
const strategies = [
  { name:'popular', pages:20, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'50'} },
  { name:'high-rated', pages:20, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'250'} },
  { name:'older-classics', pages:16, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'100', 'primary_release_date.lte':'2004-12-31'} },
  { name:'modern', pages:16, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'60', 'primary_release_date.gte':'2005-01-01', 'primary_release_date.lte':'2018-12-31'} },
  { name:'newer', pages:16, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'40', 'primary_release_date.gte':'2019-01-01'} },
  ...Object.keys(genreNames).map(id => ({
    name:`genre-${id}`,
    pages:8,
    params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'20', with_genres:id}
  }))
];

const tmdbUrl = (path, params = {}) => {
  const url = new URL(`${apiBase}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

const fetchJson = async (path, params) => {
  const response = await fetch(tmdbUrl(path, params), {
    headers: { Authorization:`Bearer ${token}`, accept:'application/json' }
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
  return response.json();
};

const normalizeMovie = movie => {
  const genre_ids = [...new Set((movie.genre_ids || []).map(Number).filter(id => genreNames[id]))];
  return {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview || '',
    poster_path: movie.poster_path || '',
    backdrop_path: movie.backdrop_path || '',
    release_date: movie.release_date || '',
    year: (movie.release_date || '').slice(0, 4),
    genre_ids,
    genreNames: genre_ids.map(id => genreNames[id]),
    vote_average: Number(movie.vote_average || 0),
    vote_count: Number(movie.vote_count || 0),
    popularity: Number(movie.popularity || 0),
    original_language: movie.original_language || ''
  };
};

const byId = new Map();
for (const strategy of strategies) {
  for (let page = 1; page <= strategy.pages; page += 1) {
    try {
      const data = await fetchJson('/discover/movie', { ...strategy.params, page:String(page) });
      (data.results || []).forEach(movie => {
        const normalized = normalizeMovie(movie);
        if (normalized.id && normalized.genre_ids.length) byId.set(normalized.id, normalized);
      });
    } catch (error) {
      console.warn(`Skipped ${strategy.name} page ${page}: ${error.message}`);
    }
  }
}

const movies = [...byId.values()].sort((a, b) => b.popularity - a.popularity);
await fs.mkdir('static/data', { recursive:true });
await fs.writeFile('static/data/movie-match-candidates.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'TMDb Discover API',
  genreNames,
  count: movies.length,
  movies
}, null, 2));
console.log(`Wrote ${movies.length} movies to static/data/movie-match-candidates.json`);
