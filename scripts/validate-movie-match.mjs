import fs from 'node:fs';

const packagePath = new URL('../static/data/movie-match-candidates.json', import.meta.url);
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const genreNames = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western'
};

const movieGenreIds = movie => [...new Set((movie.genre_ids || movie.genreIds || []).map(Number).filter(id => genreNames[id]))];
const movieYear = movie => Number(String(movie.release_date || movie.releaseDate || movie.year || '').slice(0, 4)) || 0;
const movieRuntime = movie => Number(movie.runtime || 0);
const uniqueMovies = movies => {
  const seen = new Set();
  return movies.filter(movie => {
    const key = String(movie.id || `${movie.title}-${movie.year}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const filterMovies = (movies, filters) => {
  let result = uniqueMovies(movies);
  if (filters.genre) result = result.filter(movie => movieGenreIds(movie).includes(filters.genre));
  if (filters.age === 'old') result = result.filter(movie => movieYear(movie) > 0 && movieYear(movie) < 2005);
  if (filters.age === 'modern') result = result.filter(movie => movieYear(movie) >= 2005 && movieYear(movie) <= 2018);
  if (filters.age === 'new') result = result.filter(movie => movieYear(movie) >= 2019);
  if (filters.time === 'short') result = result.filter(movie => movieRuntime(movie) > 0 && movieRuntime(movie) < 90);
  if (filters.time === 'medium') result = result.filter(movie => movieRuntime(movie) >= 90 && movieRuntime(movie) <= 140);
  if (filters.time === 'long') result = result.filter(movie => movieRuntime(movie) > 140);
  return result;
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const runCase = ({ name, filters, verify }) => {
  const results = filterMovies(packageData.movies || [], filters);
  assert(results.length > 0, `${name}: no matching movies in static package`);
  results.slice(0, 25).forEach(movie => verify(movie));
  console.log(`PASS ${name}: ${results.length} exact candidates`);
};

runCase({
  name: 'Science Fiction',
  filters: { genre: 878 },
  verify: movie => assert(movieGenreIds(movie).includes(878), `${movie.title} is missing Science Fiction`)
});
runCase({
  name: 'Thriller',
  filters: { genre: 53 },
  verify: movie => assert(movieGenreIds(movie).includes(53), `${movie.title} is missing Thriller`)
});
runCase({
  name: 'Animation + Older classic',
  filters: { genre: 16, age: 'old' },
  verify: movie => {
    assert(movieGenreIds(movie).includes(16), `${movie.title} is missing Animation`);
    assert(movieYear(movie) < 2005, `${movie.title} is not before 2005`);
  }
});
runCase({
  name: 'Science Fiction + Modern classic',
  filters: { genre: 878, age: 'modern' },
  verify: movie => {
    assert(movieGenreIds(movie).includes(878), `${movie.title} is missing Science Fiction`);
    assert(movieYear(movie) >= 2005 && movieYear(movie) <= 2018, `${movie.title} is not 2005-2018`);
  }
});
runCase({
  name: 'Any genre + Short runtime',
  filters: { time: 'short' },
  verify: movie => assert(movieRuntime(movie) < 90, `${movie.title} is not under 90 minutes`)
});

console.log(`Validated ${packageData.count || packageData.movies?.length || 0} static Movie Match candidates.`);
