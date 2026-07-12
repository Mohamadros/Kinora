import fs from 'node:fs/promises';

const tokenFromHugo = async () => {
  try {
    const config = await fs.readFile('hugo.toml', 'utf8');
    return config.match(/tmdbToken\s*=\s*"([^"]+)"/)?.[1] || '';
  } catch {
    return '';
  }
};

const token = process.env.TMDB_TOKEN || await tokenFromHugo();
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
const targetMovieCount = 4500;
const hydrationLimit = 5200;
const minimumGenreCoverage = 180;
const qualityFloor = movie => Number(movie.vote_count || 0) >= 8 && Number(movie.vote_average || 0) >= 4.8 && movie.release_date;
const strategies = [
  { name:'popular', pages:40, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'30'} },
  { name:'high-rated', pages:40, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'120'} },
  { name:'older-classics', pages:35, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'45', 'primary_release_date.lte':'2004-12-31'} },
  { name:'modern', pages:35, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'25', 'primary_release_date.gte':'2005-01-01', 'primary_release_date.lte':'2018-12-31'} },
  { name:'newer', pages:35, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'15', 'primary_release_date.gte':'2019-01-01'} },
  ...Object.keys(genreNames).flatMap(id => [
    { name:`genre-${id}-popular`, pages:18, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'8', with_genres:id} },
    { name:`genre-${id}-rated`, pages:18, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'35', with_genres:id} },
    { name:`genre-${id}-classic`, pages:10, params:{...base, sort_by:'vote_average.desc', 'vote_count.gte':'18', with_genres:id, 'primary_release_date.lte':'2004-12-31'} },
    { name:`genre-${id}-modern`, pages:10, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'12', with_genres:id, 'primary_release_date.gte':'2005-01-01', 'primary_release_date.lte':'2018-12-31'} },
    { name:`genre-${id}-newer`, pages:10, params:{...base, sort_by:'popularity.desc', 'vote_count.gte':'8', with_genres:id, 'primary_release_date.gte':'2019-01-01'} }
  ])
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
    original_language: movie.original_language || '',
    runtime: Number(movie.runtime || 0)
  };
};

const qualityScore = movie => {
  const voteCount = Number(movie.vote_count || 0);
  const voteAverage = Number(movie.vote_average || 0);
  const popularity = Number(movie.popularity || 0);
  const year = Number((movie.release_date || '').slice(0, 4)) || 0;
  const posterBoost = movie.poster_path ? 20 : 0;
  const recencyBalance = year >= 2019 ? 7 : year >= 2005 ? 10 : 12;
  return (Math.log10(voteCount + 1) * 45) + (voteAverage * 14) + Math.min(popularity, 800) * 0.22 + posterBoost + recencyBalance;
};

const genreCoverage = movies => Object.fromEntries(Object.entries(genreNames).map(([id, name]) => [
  name,
  movies.filter(movie => movie.genre_ids.includes(Number(id))).length
]));

const selectBalancedMovies = sourceMovies => {
  const ordered = [...sourceMovies].filter(qualityFloor).sort((a, b) => qualityScore(b) - qualityScore(a));
  const selected = new Map();
  const addMovie = movie => {
    if (selected.size >= targetMovieCount) return;
    if (movie?.id) selected.set(movie.id, movie);
  };
  Object.keys(genreNames).map(Number).forEach(genreId => {
    ordered
      .filter(movie => movie.genre_ids.includes(genreId))
      .slice(0, minimumGenreCoverage)
      .forEach(addMovie);
  });
  ordered.forEach(addMovie);
  return [...selected.values()].slice(0, targetMovieCount).sort((a, b) => qualityScore(b) - qualityScore(a));
};

const hydrateRuntime = async movies => {
  const concurrency = 10;
  let index = 0;
  const hydrated = new Map();
  const worker = async () => {
    while (index < movies.length) {
      const movie = movies[index];
      index += 1;
      try {
        const detail = await fetchJson(`/movie/${movie.id}`, {});
        hydrated.set(movie.id, normalizeMovie({ ...movie, runtime: detail.runtime || 0 }));
      } catch (error) {
        console.warn(`Skipped runtime for ${movie.title}: ${error.message}`);
        hydrated.set(movie.id, movie);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return movies.map(movie => hydrated.get(movie.id) || movie);
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

const fetchedMovies = [...byId.values()].filter(qualityFloor).sort((a, b) => qualityScore(b) - qualityScore(a));
const hydratedSource = await hydrateRuntime(fetchedMovies.slice(0, hydrationLimit));
const movies = selectBalancedMovies(hydratedSource);
const coverage = genreCoverage(movies);
if (movies.length < 4000) {
  console.error(`Static package too small: ${movies.length}. Expected at least 4000.`);
  process.exit(1);
}
const weakGenres = Object.entries(coverage).filter(([, count]) => count < minimumGenreCoverage);
if (weakGenres.length) {
  console.error('Genre coverage too weak:', Object.fromEntries(weakGenres));
  process.exit(1);
}
await fs.mkdir('static/data', { recursive:true });
await fs.writeFile('static/data/movie-match-candidates.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'TMDb Discover API',
  genreNames,
  count: movies.length,
  genreCoverage: coverage,
  movies
}, null, 2));
console.log(`Wrote ${movies.length} movies to static/data/movie-match-candidates.json`);
console.table(coverage);
