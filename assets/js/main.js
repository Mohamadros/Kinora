/* CineScope — framework-free interactions.
   Add a TMDB Read Access Token in hugo.toml to enable live movie data.
   A static Hugo site exposes browser-side tokens. For a public production
   project, route TMDB requests through a serverless function instead. */

const header = document.querySelector('[data-header]');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.primary-nav');
const token = document.querySelector('meta[name="tmdb-token"]')?.content.trim() || '';
const siteRoot = document.body?.dataset.siteRoot || '/';
const apiBase = 'https://api.themoviedb.org/3';
const imageBase = 'https://image.tmdb.org/t/p/w500';
let genreNames = { 12: 'Adventure', 16: 'Animation', 18: 'Drama', 27: 'Horror', 28: 'Action', 35: 'Comedy', 36: 'History', 53: 'Thriller', 80: 'Crime', 99: 'Documentary', 10749: 'Romance', 10751: 'Family', 878: 'Science Fiction' };

const closeNav = () => {
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Open navigation');
  document.body.classList.remove('nav-open');
};
toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  toggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
  document.body.classList.toggle('nav-open', !open);
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
window.addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 40), { passive: true });

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
}), { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  document.querySelectorAll('.primary-nav a').forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
}), { rootMargin: '-25% 0px -65% 0px' });
document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));

const tmdb = async (path, params = {}) => {
  if (!token) throw new Error('TMDB token not configured');
  const url = new URL(`${apiBase}${path}`);
  Object.entries(params).forEach(([key, value]) => value !== '' && url.searchParams.set(key, value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`TMDB request failed: ${response.status}`);
  return response.json();
};

const posterFallback = title => {
  const safeTitle=String(title||'Cinema Pick').replace(/[&<>]/g,letter=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[letter]));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5c0a0a"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><rect x="28" y="28" width="344" height="544" fill="none" stroke="#d4af37" stroke-width="6"/><circle cx="200" cy="150" r="54" fill="none" stroke="#d4af37" stroke-width="10"/><circle cx="200" cy="150" r="16" fill="#d4af37"/><text x="200" y="330" fill="#f5f5f5" font-family="Georgia,serif" font-size="38" text-anchor="middle" font-weight="700">${safeTitle}</text><text x="200" y="500" fill="#d4af37" font-family="Arial,sans-serif" font-size="18" text-anchor="middle" letter-spacing="4">CINEMA PICK</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
const assistantPosterFallback = title => {
  const safeTitle=String(title||'Cinema Pick').replace(/[&<>]/g,letter=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[letter]));
  const hue=[...safeTitle].reduce((total,letter)=>total+letter.charCodeAt(0),0)%360;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue},70%,22%)"/><stop offset=".54" stop-color="#5c0a0a"/><stop offset="1" stop-color="#080808"/></linearGradient><radialGradient id="spot" cx=".5" cy=".18" r=".7"><stop stop-color="#f6e2a0" stop-opacity=".9"/><stop offset=".35" stop-color="#d4af37" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="400" height="600" fill="url(#bg)"/><rect width="400" height="600" fill="url(#spot)"/><rect x="24" y="24" width="352" height="552" fill="none" stroke="#d4af37" stroke-width="7"/><rect x="48" y="62" width="304" height="270" fill="rgba(0,0,0,.2)" stroke="rgba(245,245,245,.28)" stroke-width="2"/><circle cx="200" cy="178" r="62" fill="none" stroke="#f5f5f5" stroke-opacity=".75" stroke-width="9"/><path d="M185 145l62 36-62 36z" fill="#d4af37"/><text x="200" y="405" fill="#f5f5f5" font-family="Georgia,serif" font-size="34" text-anchor="middle" font-weight="700">${safeTitle}</text><text x="200" y="522" fill="#d4af37" font-family="Arial,sans-serif" font-size="17" text-anchor="middle" letter-spacing="4">MOVIE PICK</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const normalizeMovie = movie => ({
  id: movie.id || null,
  title: movie.title,
  year: (movie.release_date || movie.year || 'TBA').slice(0, 4),
  releaseDate: movie.release_date || movie.releaseDate || '',
  rating: Number(movie.vote_average ?? movie.rating ?? 0).toFixed(1),
  overview: movie.overview || 'Details will be announced closer to release.',
  poster: movie.poster_path ? `${imageBase}${movie.poster_path}` : (movie.poster || posterFallback(movie.title)),
  genreIds: movie.genre_ids || movie.genreIds || [],
  genre: movie.genre || (movie.genre_ids || []).slice(0, 2).map(id => genreNames[id]).filter(Boolean).join(' · '),
  trailerQuery: movie.trailerQuery || `${movie.title} official trailer`
});

const createMovieCard = rawMovie => {
  const movie = normalizeMovie(rawMovie);
  const card = document.querySelector('#movie-card-template').content.firstElementChild.cloneNode(true);
  const image = card.querySelector('img');
  image.src = movie.poster; image.alt = `Poster for ${movie.title}`;
  image.addEventListener('error', () => { image.src = posterFallback(movie.title); }, { once: true });
  card.querySelector('.movie-rating').textContent = movie.rating === '0.0' ? 'Not rated' : `★ ${movie.rating}`;
  card.querySelector('.movie-year').textContent = movie.releaseDate || movie.year;
  card.querySelector('.movie-genre').textContent = movie.genre || 'Film';
  card.querySelector('h3').textContent = movie.title;
  card.querySelector('.movie-copy p').textContent = movie.overview;
  card.querySelector('.trailer-button').addEventListener('click', () => openTrailer(movie));
  card.dataset.genres = movie.genreIds.join(' ');
  card.dataset.title = movie.title.toLowerCase();
  return card;
};

const renderMovies = (container, movies, append = false) => {
  const cards = movies.map(createMovieCard);
  if (append) container.append(...cards); else container.replaceChildren(...cards);
  cards.forEach(card => { card.classList.add('is-visible'); });
};

const moodConfig = {
  happy: { label: 'Happy', genres: '35,16,12,10751', target: ['joy','kindness','friendship','funny','warm','playful','family','adventure','hope','uplifting'], avoid: ['grief','death','murder','war','trauma'], reason: 'These films protect a happy mood with warmth, humor, friendship, and low emotional heaviness.' },
  sad: { label: 'Sad', genres: '18,10749', target: ['grief','loss','memory','father','mother','family','healing','relationship','quiet','emotional','tender'], avoid: ['slasher','explosive','revenge','superhero'], reason: 'These films meet sadness gently: emotional stories that allow reflection, empathy, and release.' },
  lonely: { label: 'Lonely', genres: '18,10749,878', target: ['alone','lonely','connection','friendship','stranger','city','isolation','relationship','identity','self-discovery'], avoid: ['team','war','battle','heist'], reason: 'These films focus on connection, solitude, and characters trying to be understood.' },
  romantic: { label: 'Romantic', genres: '10749,18,35', target: ['love','romance','relationship','wedding','couple','heart','chance','together','intimacy'], avoid: ['murder','war','monster','apocalypse'], reason: 'These films are chosen for emotional intimacy, chemistry, and love stories rather than just the romance genre label.' },
  motivated: { label: 'Motivated', genres: '18,36,12,28', target: ['dream','ambition','fight','survive','training','success','journey','courage','underdog','mission','persistence'], avoid: ['despair','hopeless','grief'], reason: 'These films emphasize drive, discipline, survival, and people pushing past limits.' },
  stressed: { label: 'Stressed', genres: '35,16,10751,99', target: ['gentle','nature','friendship','family','comfort','funny','warm','simple','healing','peaceful'], avoid: ['horror','murder','terror','nightmare','crime','violent','war'], reason: 'These films avoid harsh intensity and aim for comfort, lightness, and emotional reset.' },
  thoughtful: { label: 'Thoughtful', genres: '18,878,99,36', target: ['identity','truth','memory','time','future','question','society','human','language','consciousness','mystery'], avoid: ['gross-out','slapstick'], reason: 'These films are selected for ideas that stay with you after the credits: identity, time, society, and meaning.' },
  excited: { label: 'Excited', genres: '28,12,53,878', target: ['mission','chase','battle','escape','danger','hero','adventure','race','fight','spectacle','explosive'], avoid: ['quiet','slow','meditation'], reason: 'These films convert excitement into movement: action, suspense, spectacle, and momentum.' },
  nostalgic: { label: 'Nostalgic', genres: '18,36,10749,35', target: ['memory','childhood','home','past','return','summer','family','cinema','old','friend','remember'], avoid: ['future','cyber','apocalypse'], reason: 'These films are chosen for memory, home, childhood, and the feeling of looking back.' }
};

const moodFallback = {
  happy: [['Paddington 2',2017,8.1,'A generous, joyful comedy about kindness becoming contagious.','Comedy'],['Sing Street',2016,7.9,'A teenager starts a band and discovers a larger version of his life.','Music · Comedy'],['Amélie',2001,7.9,'A whimsical celebration of small pleasures and human connection.','Romance · Comedy']],
  sad: [['Aftersun',2022,7.7,'A daughter revisits the fragile memories of a holiday with her father.','Drama'],['The Iron Claw',2023,7.5,'Brotherhood and grief collide inside a celebrated wrestling family.','Drama'],['Manchester by the Sea',2016,7.5,'A deeply human story about grief, responsibility, and survival.','Drama']],
  lonely: [['Her',2013,8.0,'A solitary writer develops an unexpected relationship with an operating system.','Drama · Romance'],['Lost in Translation',2003,7.7,'Two strangers find recognition and companionship far from home.','Drama'],['The Secret Life of Walter Mitty',2013,7.3,'A quiet dreamer steps beyond routine and into the world.','Adventure · Drama']],
  romantic: [['Before Sunrise',1995,8.1,'Two travelers meet by chance and spend one night walking through Vienna.','Romance · Drama'],['La La Land',2016,7.9,'Love and ambition share the stage in a modern musical.','Romance · Music'],['About Time',2013,7.8,'A time traveler learns that ordinary days are the heart of a life.','Romance · Comedy']],
  motivated: [['Rocky',1976,8.0,'An unknown boxer earns one chance to prove what persistence means.','Drama'],['Whiplash',2014,8.4,'A drummer pushes ambition toward its exhilarating and dangerous limits.','Drama · Music'],['The Pursuit of Happyness',2006,8.0,'A father refuses to let hardship define his family’s future.','Drama']],
  stressed: [['My Neighbor Totoro',1988,8.1,'Two sisters discover gentle forest spirits near their new home.','Animation'],['Chef',2014,7.3,'A chef rediscovers creativity, family, and pleasure through a food truck.','Comedy'],['The Biggest Little Farm',2018,8.0,'A restorative portrait of patience, ecology, and learning from the land.','Documentary']],
  thoughtful: [['Arrival',2016,7.9,'Language, time, and loss reshape humanity’s first encounter.','Science Fiction'],['The Truman Show',1998,8.2,'A man begins to question the perfectly constructed world around him.','Drama'],['After Yang',2021,6.7,'A family’s loss opens questions about memory and what makes a life.','Science Fiction · Drama']],
  excited: [['Mad Max: Fury Road',2015,8.1,'A breathtaking chase turns action filmmaking into pure visual momentum.','Action'],['Mission: Impossible – Fallout',2018,7.4,'Precision stunt work drives an escalating global mission.','Action · Thriller'],['Spider-Man: Into the Spider-Verse',2018,8.4,'A vivid leap across dimensions, identities, and animation styles.','Animation · Action']],
  nostalgic: [['Cinema Paradiso',1988,8.5,'A filmmaker remembers the theater and friendship that shaped his childhood.','Drama'],['The Fabelmans',2022,7.5,'A young filmmaker discovers how cameras transform family memory.','Drama'],['Midnight in Paris',2011,7.6,'A writer discovers the seduction—and illusion—of another era.','Comedy · Romance']]
};
Object.keys(moodFallback).forEach(key => { moodFallback[key] = moodFallback[key].map((m, i) => ({ id: null, title:m[0], year:String(m[1]), rating:m[2], overview:m[3], genre:m[4], genreIds:moodConfig[key].genres.split(',').map(Number), trailerQuery:`${m[0]} official trailer`, poster:posterFallback(m[0]+i) })); });

const moodPanel = document.querySelector('[data-recommendation-panel]');
const textMatchesAny=(text,words)=>words.some(word=>text.includes(word));
const scoreMoodMovie=(rawMovie,config)=>{
  const movie=normalizeMovie(rawMovie);
  const text=`${movie.title} ${movie.overview} ${movie.genre}`.toLowerCase();
  const genreIds=movie.genreIds||[];
  const targetScore=config.target.reduce((score,word)=>score+(text.includes(word)?2.6:0),0);
  const avoidScore=config.avoid.reduce((score,word)=>score+(text.includes(word)?4.5:0),0);
  const genreScore=config.genres.split(',').map(Number).reduce((score,id)=>score+(genreIds.includes(id)?2.2:0),0);
  const ratingScore=Number(movie.rating||0);
  const posterScore=movie.poster&&!String(movie.poster).startsWith('data:')?1.2:0;
  const fitBoost=textMatchesAny(text,config.target)?4:0;
  return ratingScore+genreScore+targetScore+fitBoost+posterScore-avoidScore;
};
const fetchMoodMovies=async (key,config)=>{
  if(!token)throw new Error('TMDB token not configured');
  const pages=[1,2,3,4,5].map(page=>tmdb('/discover/movie',{
    with_genres:config.genres,
    sort_by:page%2?'vote_average.desc':'popularity.desc',
    'vote_count.gte':'250',
    include_adult:'false',
    page:String(page)
  }).catch(()=>({results:[]})));
  const seen=new Set();
  return (await Promise.all(pages))
    .flatMap(data=>data.results||[])
    .filter(movie=>movie.poster_path)
    .filter(movie=>{
      const key=movie.id||movie.title;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .map(normalizeMovie)
    .map(movie=>({movie,score:scoreMoodMovie(movie,config)}))
    .filter(item=>item.score>8)
    .sort((a,b)=>b.score-a.score)
    .slice(0,6)
    .map(item=>item.movie);
};
document.querySelectorAll('[data-mood]').forEach(button => button.addEventListener('click', async () => {
  if (!moodPanel) return;
  const key = button.dataset.mood; const config = moodConfig[key];
  document.querySelectorAll('[data-mood]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  moodPanel.hidden = false;
  moodPanel.querySelector('[data-mood-title]').textContent = `You selected ${config.label}.`;
  moodPanel.querySelector('[data-mood-reason]').textContent = config.reason;
  moodPanel.querySelector('input[name="mood"]').value = config.label;
  const status = moodPanel.querySelector('[data-mood-status]'); const results = moodPanel.querySelector('[data-mood-results]');
  status.textContent = token ? `Searching for films that fit ${config.label.toLowerCase()} emotionally…` : 'Showing curated mood selections. Add a TMDB token for live discovery.';
  moodPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const movies=await fetchMoodMovies(key,config);
    renderMovies(results, movies.length?movies:moodFallback[key]);
    status.textContent = movies.length ? `Matched by mood signals: ${config.target.slice(0,5).join(', ')}.` : 'Showing curated selections because the live catalogue did not return enough emotional matches.';
  } catch { renderMovies(results, moodFallback[key]); status.textContent='Showing curated selections for this mood.'; }
}));

const feedbackForm = document.querySelector('[data-feedback-form]');
feedbackForm?.querySelectorAll('[data-score]').forEach(button => button.addEventListener('click', async () => {
  const score = Number(button.dataset.score); feedbackForm.querySelector('input[name="score"]').value = String(score);
  feedbackForm.querySelectorAll('[data-score]').forEach(star => star.classList.toggle('is-active', Number(star.dataset.score) <= score));
  const entry = { mood: feedbackForm.elements.mood.value, score, recordedAt: new Date().toISOString() };
  const saved = JSON.parse(localStorage.getItem('cinemaMoodFeedback') || '[]'); saved.push(entry); localStorage.setItem('cinemaMoodFeedback', JSON.stringify(saved));
  feedbackForm.querySelector('[data-feedback-message]').textContent = 'Thank you — response saved.';
  if (!['localhost','127.0.0.1'].includes(location.hostname)) fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(new FormData(feedbackForm)).toString() }).catch(() => {});
}));

const fallbackUpcoming = [
  {title:'The Odyssey',release_date:'2026-07-17',overview:'A mythic voyage home across a world of gods, monsters, and human endurance.',genreIds:[12,18],platform:'Cinema release',releaseType:'cinema',director:'Christopher Nolan',actors:'Matt Damon, Tom Holland, Anne Hathaway',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A large-format mythic adventure from a filmmaker known for theatrical spectacle.'},
  {title:'Spider-Man: Brand New Day',release_date:'2026-07-31',overview:'A new chapter begins for the web-slinging hero in New York City.',genreIds:[28,12],platform:'Cinema release',releaseType:'cinema',director:'Destin Daniel Cretton',actors:'Tom Holland, Zendaya',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A fresh Spider-Man chapter has strong franchise momentum and broad audience interest.'},
  {title:'Minions 3',release_date:'2026-07-01',overview:'The mischievous yellow crew returns for another animated adventure.',genreIds:[16,35],platform:'Cinema release',releaseType:'cinema',director:'Pierre Coffin',actors:'Voice cast TBA',trailerAvailable:false,buzz:'Medium',tag:'Limited information',why:'A family-friendly franchise title likely to be easy, playful summer cinema.'},
  {title:'Avengers: Doomsday',release_date:'2026-12-18',overview:'Heroes across the universe assemble against a formidable new threat.',genreIds:[28,878],platform:'Cinema release',releaseType:'cinema',director:'Anthony Russo, Joe Russo',actors:'Marvel ensemble cast',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A major crossover event film with built-in audience anticipation.'},
  {title:'Dune: Part Three',release_date:'2026-12-18',overview:'The desert saga continues as power, prophecy, and consequence converge.',genreIds:[878,12],platform:'Cinema release',releaseType:'cinema',director:'Denis Villeneuve',actors:'Timothée Chalamet, Zendaya',trailerAvailable:false,buzz:'High',tag:'Festival buzz',why:'The previous films built a strong visual identity, making this a likely big-screen event.'},
  {title:'Spider-Man: Beyond the Spider-Verse',release_date:'2027-06-04',overview:'Miles Morales continues his journey across a limitless animated multiverse.',genreIds:[16,28],platform:'Cinema release',releaseType:'cinema',director:'Joaquim Dos Santos, Kemp Powers, Justin K. Thompson',actors:'Shameik Moore, Hailee Steinfeld',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'The series is known for innovative animation and emotional superhero storytelling.'},
  {title:'The Batman: Part II',release_date:'2027-10-01',overview:'Gotham’s detective returns to confront a new shadow over the city.',genreIds:[80,18],platform:'Cinema release',releaseType:'cinema',director:'Matt Reeves',actors:'Robert Pattinson',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A noir detective tone could make this stand apart from typical superhero releases.'},
  {title:'Frozen III',release_date:'2027-11-24',overview:'The sisters of Arendelle begin another journey beyond their kingdom.',genreIds:[16,10751],platform:'Cinema release',releaseType:'cinema',director:'Jennifer Lee',actors:'Kristen Bell, Idina Menzel',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A major family release with music, nostalgia, and strong global recognition.'},
  {title:'28 Years Later: The Bone Temple',release_date:'2026-01-16',overview:'A new chapter expands the infected-world horror story with fresh survivors and danger.',genreIds:[27,53],platform:'Cinema release',releaseType:'cinema',director:'Nia DaCosta',actors:'Cast TBA',trailerAvailable:true,buzz:'Medium',tag:'Trailer out',why:'A revived horror universe could attract viewers looking for tense theatrical atmosphere.'},
  {title:'Project Hail Mary',release_date:'2026-03-20',overview:'An astronaut wakes alone on a mission that could decide the fate of Earth.',genreIds:[878,12],platform:'Cinema release',releaseType:'cinema',director:'Phil Lord, Christopher Miller',actors:'Ryan Gosling',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A science-fiction survival premise with emotional scale and broad audience appeal.'},
  {title:'The Mandalorian & Grogu',release_date:'2026-05-22',overview:'The Star Wars duo moves from streaming culture into a theatrical adventure.',genreIds:[878,12],platform:'Cinema release',releaseType:'cinema',director:'Jon Favreau',actors:'Pedro Pascal',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'It is interesting as a streaming-born story returning to cinema screens.'},
  {title:'Wake Up Dead Man',release_date:'2026-01-01',overview:'Detective Benoit Blanc returns for a new mystery with a new ensemble.',genreIds:[80,35,18],platform:'Netflix',releaseType:'streaming',director:'Rian Johnson',actors:'Daniel Craig, ensemble cast',trailerAvailable:false,buzz:'Medium',tag:'Limited information',why:'A new mystery from an audience-friendly series could be a strong streaming event.'},
  {title:'Mercy',release_date:'2026-01-23',overview:'A near-future thriller about justice, technology, and a race against time.',genreIds:[878,53],platform:'Prime Video',releaseType:'streaming',director:'Timur Bekmambetov',actors:'Chris Pratt, Rebecca Ferguson',trailerAvailable:false,buzz:'Medium',tag:'No audience rating yet',why:'The tech-thriller premise connects directly with digital-age questions about law, surveillance, and control.'},
  {title:'The Bluff',release_date:'2026-09-18',overview:'A period adventure about survival, danger, and buried secrets.',genreIds:[12,18],platform:'Prime Video',releaseType:'streaming',director:'Frank E. Flowers',actors:'Priyanka Chopra Jonas',trailerAvailable:false,buzz:'Low',tag:'Limited information',why:'A streaming adventure release could be worth tracking if early footage shows strong atmosphere.'},
  {title:'Narnia: The Magician’s Nephew',release_date:'2026-11-26',overview:'A fantasy origin story opens a door into another world.',genreIds:[12,10751],platform:'Netflix',releaseType:'streaming',director:'Greta Gerwig',actors:'Cast TBA',trailerAvailable:false,buzz:'High',tag:'Highly anticipated',why:'A major literary fantasy property from a high-profile filmmaker could become a major streaming event.'}
].map(movie => ({...movie, rating:0, genre:movie.genreIds.map(id=>genreNames[id]).filter(Boolean).join(' · '), poster:posterFallback(movie.title)}));

const comingResults = document.querySelector('[data-coming-results]');
const comingStatus = document.querySelector('[data-coming-status]');
const radarLists = document.querySelector('[data-radar-lists]');
const genreFilter = document.querySelector('[data-genre-filter]');
const movieSearch = document.querySelector('[data-movie-search]');
const dateFilter = document.querySelector('[data-date-filter]');
const anticipatedFilter = document.querySelector('[data-anticipated-filter]');
const loadMoreButton = document.querySelector('[data-load-more]');
const apiNotice = document.querySelector('[data-api-notice]');
const radarWatchlistKey='futureMovieRadarWatchlist';
const radarHiddenKey='futureMovieRadarHidden';
let comingMovies = [];
let comingPage = 0;
let comingTotalPages = 1;
let comingLoading = false;
let radarVisibleCount = 12;
const radarInitialCount = 12;
const radarLoadMoreCount = 8;
const radarCreditsCache=new Map();

const fillGenres = genres => { genres.forEach(genre => { const option=document.createElement('option'); option.value=genre.id; option.textContent=genre.name; genreFilter?.append(option); }); };
const getRadarStore=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}};
const setRadarStore=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
const radarMovieByTitle=title=>comingMovies.map(normalizeRadarMovie).find(movie=>movie.title===title);
const renderRadarLists=()=>{
  if(!radarLists)return;
  const watchlist=getRadarStore(radarWatchlistKey);
  const hidden=getRadarStore(radarHiddenKey);
  radarLists.replaceChildren();
  if(!watchlist.length&&!hidden.length){
    radarLists.hidden=true;
    return;
  }
  radarLists.hidden=false;
  const makeGroup=(title,items,type)=>{
    const group=document.createElement('section');
    group.className='radar-list-group';
    const heading=document.createElement('h3');
    heading.textContent=`${title} (${items.length})`;
    const list=document.createElement('ul');
    if(!items.length){
      const empty=document.createElement('li');
      empty.className='radar-list-empty';
      empty.textContent='Nothing here yet.';
      list.append(empty);
    }
    items.forEach(item=>{
      const li=document.createElement('li');
      const name=document.createElement('span');
      name.textContent=item;
      const action=document.createElement('button');
      action.type='button';
      action.textContent=type==='hidden'?'Restore':'Remove';
      action.addEventListener('click',()=>{
        const key=type==='hidden'?radarHiddenKey:radarWatchlistKey;
        setRadarStore(key,getRadarStore(key).filter(title=>title!==item));
        renderRadarLists();
        showComing(filterRadarMovies(comingMovies));
      });
      li.append(name,action);
      list.append(li);
    });
    group.append(heading,list);
    return group;
  };
  radarLists.append(makeGroup('Watchlist',watchlist,'watchlist'),makeGroup('Not interested',hidden,'hidden'));
};
const normalizeRadarMovie=rawMovie=>{
  const movie=normalizeMovie(rawMovie);
  const releaseType=rawMovie.releaseType||rawMovie.release_type||'cinema';
  const platform=rawMovie.platform||rawMovie.platforms?.[0]||(releaseType==='streaming'?'Streaming':'Cinema release');
  const popularity=Number(rawMovie.popularity||0);
  const buzz=rawMovie.buzz||(popularity>=10?'High':popularity>=3?'Medium':'Low');
  const trailerAvailable=Boolean(rawMovie.trailerAvailable||rawMovie.trailer_available);
  const tag=rawMovie.tag||(trailerAvailable?'Trailer out':buzz==='High'?'Highly anticipated':buzz==='Medium'?'No audience rating yet':'Limited information');
  return {
    ...movie,
    releaseType,
    platform,
    director:rawMovie.director||'Director not announced',
    actors:rawMovie.actors||rawMovie.cast||'Main cast not fully announced',
    trailerAvailable,
    buzz,
    tag,
    why:rawMovie.why||`This ${movie.genre||'film'} is worth tracking because its release date, genre, and early visibility suggest audience interest.`,
    popularity
  };
};
const buzzRank=buzz=>({Low:1,Medium:2,High:3}[buzz]||1);
const getRadarFilters=()=>({
  query:movieSearch?.value.trim().toLowerCase()||'',
  genre:genreFilter?.value||'',
  date:dateFilter?.value||'',
  anticipated:anticipatedFilter?.value||''
});
const addDays=(date,days)=>{
  const next=new Date(date);
  next.setDate(next.getDate()+days);
  return next;
};
const toISODate=date=>date.toISOString().slice(0,10);
const radarDateRange=(value)=>{
  const now=new Date();
  const today=toISODate(now);
  if(value==='30')return {gte:today,lte:toISODate(addDays(now,30))};
  if(value==='90')return {gte:today,lte:toISODate(addDays(now,90))};
  if(value==='year')return {gte:today,lte:`${now.getFullYear()}-12-31`};
  if(value==='next-year')return {gte:`${now.getFullYear()+1}-01-01`,lte:`${now.getFullYear()+1}-12-31`};
  return {gte:today,lte:''};
};
const filterRadarMovies=(movies,filters=getRadarFilters())=>{
  const hidden=new Set(getRadarStore(radarHiddenKey));
  return movies.map(normalizeRadarMovie).filter(movie=>{
    const searchable=`${movie.title} ${movie.overview} ${movie.genre} ${movie.director} ${movie.actors}`.toLowerCase();
    const genreMatch=!filters.genre||movie.genreIds.includes(Number(filters.genre));
    const range=radarDateRange(filters.date);
    const releaseDate=movie.releaseDate||movie.release_date||'';
    const dateMatch=!releaseDate||(!range.gte||releaseDate>=range.gte)&&(!range.lte||releaseDate<=range.lte);
    const buzzMatch=!filters.anticipated||(filters.anticipated==='high'?movie.buzz==='High':buzzRank(movie.buzz)>=2);
    return !hidden.has(movie.title)&&
      (!filters.query||searchable.includes(filters.query))&&
      genreMatch&&
      dateMatch&&
      buzzMatch;
  }).sort((a,b)=>{
    if(filters.anticipated==='high')return Number(b.popularity||0)-Number(a.popularity||0)||a.releaseDate.localeCompare(b.releaseDate);
    if(filters.anticipated==='medium'){
      const aMedium=a.buzz==='Medium'?0:a.buzz==='High'?1:2;
      const bMedium=b.buzz==='Medium'?0:b.buzz==='High'?1:2;
      return aMedium-bMedium||Number(b.popularity||0)-Number(a.popularity||0)||a.releaseDate.localeCompare(b.releaseDate);
    }
    return a.releaseDate.localeCompare(b.releaseDate);
  });
};
const hydrateRadarCredits=async (movie,directorNode,actorsNode)=>{
  if(!movie.id||!token)return;
  const cacheKey=String(movie.id);
  try{
    let credits=radarCreditsCache.get(cacheKey);
    if(!credits){
      const data=await tmdb(`/movie/${movie.id}/credits`);
      const director=data.crew?.find(person=>person.job==='Director')?.name||'Director not announced';
      const actors=(data.cast||[]).slice(0,3).map(person=>person.name).filter(Boolean).join(', ')||'Main cast not fully announced';
      credits={director,actors};
      radarCreditsCache.set(cacheKey,credits);
    }
    directorNode.textContent=credits.director;
    actorsNode.textContent=credits.actors;
    comingMovies=comingMovies.map(item=>(item.id&&item.id===movie.id)?{...item,director:credits.director,actors:credits.actors}:item);
  }catch{}
};
const createRadarCard=rawMovie=>{
  const movie=normalizeRadarMovie(rawMovie);
  const watchlist=new Set(getRadarStore(radarWatchlistKey));
  const card=document.createElement('article');
  card.className='radar-card movie-card';
  card.dataset.buzz=movie.buzz.toLowerCase();
  const poster=document.createElement('div');
  poster.className='movie-poster radar-poster';
  const image=document.createElement('img');
  image.src=movie.poster; image.alt=`Poster for ${movie.title}`; image.loading='lazy';
  image.addEventListener('error',()=>{image.src=posterFallback(movie.title)},{once:true});
  const label=document.createElement('span');
  label.className='movie-rating radar-signal';
  label.textContent=movie.tag;
  poster.append(image,label);
  const copy=document.createElement('div');
  copy.className='movie-copy radar-copy';
  const meta=document.createElement('div');
  meta.className='movie-meta';
  meta.innerHTML=`<span>${movie.releaseDate||movie.year}</span><span>${movie.genre||'Genre TBA'}</span>`;
  const title=document.createElement('h3');
  title.textContent=movie.title;
  const synopsis=document.createElement('p');
  synopsis.textContent=movie.overview;
  const signals=document.createElement('dl');
  signals.className='radar-signals';
  let directorNode;
  let actorsNode;
  [
    ['Release',movie.releaseDate||'Date TBA'],
    ['Buzz',movie.buzz],
    ['Director',movie.director],
    ['Main actors',movie.actors]
  ].forEach(([term,value])=>{
    const group=document.createElement('div');
    const dt=document.createElement('dt'); dt.textContent=term;
    const dd=document.createElement('dd'); dd.textContent=value;
    if(term==='Director')directorNode=dd;
    if(term==='Main actors')actorsNode=dd;
    group.append(dt,dd); signals.append(group);
  });
  hydrateRadarCredits(movie,directorNode,actorsNode);
  const actions=document.createElement('div');
  actions.className='radar-actions';
  const watch=document.createElement('button');
  watch.type='button'; watch.className='watchlist-button'; watch.textContent=watchlist.has(movie.title)?'In Watchlist':'Add to Watchlist';
  watch.addEventListener('click',()=>{
    const next=new Set(getRadarStore(radarWatchlistKey));
    next.has(movie.title)?next.delete(movie.title):next.add(movie.title);
    setRadarStore(radarWatchlistKey,[...next]);
    if(next.has(movie.title)){
      setRadarStore(radarHiddenKey,getRadarStore(radarHiddenKey).filter(title=>title!==movie.title));
    }
    watch.textContent=next.has(movie.title)?'In Watchlist':'Add to Watchlist';
    watch.classList.toggle('is-active',next.has(movie.title));
    renderRadarLists();
  });
  watch.classList.toggle('is-active',watchlist.has(movie.title));
  const trailer=document.createElement('button');
  trailer.type='button'; trailer.className='trailer-button'; trailer.innerHTML='<span aria-hidden="true">▶</span> Trailer';
  trailer.addEventListener('click',()=>openTrailer(movie));
  const hide=document.createElement('button');
  hide.type='button'; hide.className='not-interested-button'; hide.textContent='Not interested';
  hide.addEventListener('click',()=>{
    const hidden=new Set(getRadarStore(radarHiddenKey));
    hidden.add(movie.title); setRadarStore(radarHiddenKey,[...hidden]);
    setRadarStore(radarWatchlistKey,getRadarStore(radarWatchlistKey).filter(title=>title!==movie.title));
    renderRadarLists();
    showComing(filterRadarMovies(comingMovies));
  });
  actions.append(watch,trailer,hide);
  copy.append(meta,title,synopsis,signals,actions);
  card.append(poster,copy);
  return card;
};
const preserveComingPosition = callback => {
  const toolbar = document.querySelector('.movie-toolbar');
  const before = toolbar?.getBoundingClientRect().top || 0;
  callback();
  requestAnimationFrame(() => { const after=toolbar?.getBoundingClientRect().top||0; window.scrollBy(0,after-before); });
};
const showComing = (movies, append=false) => {
  const visibleMovies=movies.slice(0,radarVisibleCount);
  const cards=visibleMovies.map(createRadarCard);
  preserveComingPosition(() => { comingResults.replaceChildren(...cards); });
  cards.forEach(card=>card.classList.add('is-visible'));
  renderRadarLists();
  if(!cards.length){
    comingStatus.textContent='No movies found for this filter. Try changing your options.';
    if(loadMoreButton) loadMoreButton.hidden=true;
    return;
  }
  const total=visibleMovies.length;
  const available=movies.length;
  comingStatus.textContent=`Showing ${total} of ${available} ${available===1?'future film':'future films'} on the radar${comingTotalPages>comingPage?' — more available':''}.`;
  if(loadMoreButton) loadMoreButton.hidden=total>=available&&(!token||comingPage>=comingTotalPages);
};
const radarApiMovie=movie=>({
  ...movie,
  releaseType:'cinema',
  platform:'Cinema release',
  trailerAvailable:false,
  buzz:Number(movie.popularity||0)>=10?'High':Number(movie.popularity||0)>=3?'Medium':'Low',
  tag:Number(movie.popularity||0)>=10?'Highly anticipated':Number(movie.popularity||0)>=3?'No audience rating yet':'Limited information'
});
const radarDiscoverParams=(filters=getRadarFilters(),page=1)=>{
  const now=new Date();
  const range=radarDateRange(filters.date);
  const params={
    'primary_release_date.gte':range.gte,
    region:'DE',
    with_release_type:'2|3|4',
    sort_by:filters.anticipated?'popularity.desc':'primary_release_date.asc',
    include_adult:'false',
    page:String(page)
  };
  if(range.lte)params['primary_release_date.lte']=range.lte;
  if(filters.genre)params.with_genres=filters.genre;
  return params;
};
const loadComingPage = async (reset=false, render=true) => {
  if(comingLoading)return;
  if(reset){comingPage=0;comingTotalPages=1;comingResults.replaceChildren();radarVisibleCount=radarInitialCount;}
  if(comingPage>=comingTotalPages&&comingPage!==0)return;
  comingLoading=true;if(loadMoreButton)loadMoreButton.disabled=true;comingStatus.textContent='Loading future releases…';
  const nextPage=comingPage+1;const filters=getRadarFilters();
  try{
    let data;
    if(filters.query.length>2){
      data=await tmdb('/search/movie',{query:filters.query,include_adult:'false',region:'DE',page:String(nextPage)});
      const range=radarDateRange(filters.date);
      data.results=(data.results||[]).filter(movie=>{
        const releaseDate=movie.release_date||'';
        return (!releaseDate||releaseDate>=range.gte)&&(!range.lte||!releaseDate||releaseDate<=range.lte);
      });
    }else{
      data=await tmdb('/discover/movie',radarDiscoverParams(filters,nextPage));
    }
    comingPage=nextPage;comingTotalPages=Math.min(Number(data.total_pages)||1,500);
    const batch=(data.results||[]).map(radarApiMovie);
    comingMovies=reset?batch:[...comingMovies,...batch];
    if(render)showComing(filterRadarMovies(comingMovies));
  }catch{comingStatus.textContent='The live movie catalogue could not be reached. Please check the TMDB token.';}
  finally{comingLoading=false;if(loadMoreButton)loadMoreButton.disabled=false;}
};
const loadComing = async () => {
  if(token){
    try{
      const genres=await tmdb('/genre/movie/list');
      genreNames=Object.fromEntries(genres.genres.map(g=>[g.id,g.name]));
      fillGenres(genres.genres);
      await loadComingPage(true);
      await loadComingPage(false);
      await loadComingPage(false);
      return;
    }catch{}
  }
  apiNotice.hidden=false;comingMovies=fallbackUpcoming;fillGenres(Object.entries(genreNames).map(([id,name])=>({id,name})));comingPage=1;comingTotalPages=1;radarVisibleCount=radarInitialCount;showComing(filterRadarMovies(comingMovies));comingStatus.textContent=`Showing ${Math.min(radarVisibleCount,comingMovies.length)} of ${comingMovies.length} radar demonstration films. Connect TMDB for the complete live catalogue and official posters.`;
};
const mergeRadarMovies=movies=>{
  const seen=new Set(comingMovies.map(movie=>movie.id||movie.title));
  const fresh=movies.filter(movie=>{
    const key=movie.id||movie.title;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  comingMovies=[...comingMovies,...fresh];
};
const applyRadarFilters=async ()=>{
  if(token){
    const filters=getRadarFilters();
    radarVisibleCount=radarInitialCount;
    await loadComingPage(true);
    await loadComingPage(false);
    await loadComingPage(false);
    if(filters.anticipated){
      await loadComingPage(false);
      await loadComingPage(false);
    }
    return;
  }
  radarVisibleCount=radarInitialCount;
  showComing(filterRadarMovies(comingMovies));
};
genreFilter?.addEventListener('change',applyRadarFilters);
dateFilter?.addEventListener('change',applyRadarFilters);
anticipatedFilter?.addEventListener('change',applyRadarFilters);
loadMoreButton?.addEventListener('click',async()=>{
  radarVisibleCount+=radarLoadMoreCount;
  let filtered=filterRadarMovies(comingMovies);
  while(token&&filtered.length<radarVisibleCount&&comingPage<comingTotalPages&&!comingLoading){
    await loadComingPage(false,false);
    filtered=filterRadarMovies(comingMovies);
  }
  showComing(filtered);
});
let searchTimer;
movieSearch?.addEventListener('input', () => {
  clearTimeout(searchTimer); searchTimer=setTimeout(() => {
    applyRadarFilters();
  },350);
});
if (comingResults) loadComing();

const journalEntries=[...document.querySelectorAll('[data-journal-entry]')];
const journalSearch=document.querySelector('[data-journal-search]');
let journalCategory='all';
const filterJournal=()=>{ const query=(journalSearch?.value||'').trim().toLowerCase(); let visible=0; journalEntries.forEach(entry=>{ const matchCategory=journalCategory==='all'||entry.dataset.category.split(' ').includes(journalCategory); const matchSearch=!query||entry.dataset.search.includes(query); const show=matchCategory&&matchSearch; entry.hidden=!show; if(show)visible++; }); const empty=document.querySelector('[data-journal-empty]'); if(empty)empty.hidden=visible!==0; };
document.querySelectorAll('[data-journal-filter]').forEach(button=>button.addEventListener('click',()=>{journalCategory=button.dataset.journalFilter;document.querySelectorAll('[data-journal-filter]').forEach(item=>item.classList.toggle('is-active',item===button));filterJournal();}));
journalSearch?.addEventListener('input',filterJournal);

const trailerDialog=document.querySelector('[data-trailer-dialog]');
const openTrailer=async movie=>{
  const content=trailerDialog.querySelector('[data-trailer-content]'); const message=trailerDialog.querySelector('[data-trailer-message]'); content.replaceChildren(); message.textContent='Finding the trailer…'; trailerDialog.showModal();
  if(movie.id&&token){try{const data=await tmdb(`/movie/${movie.id}/videos`);const video=data.results.find(v=>v.site==='YouTube'&&v.type==='Trailer')||data.results.find(v=>v.site==='YouTube');if(video){const iframe=document.createElement('iframe');iframe.src=`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`;iframe.title=`${movie.title} trailer`;iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;content.append(iframe);message.textContent='';return;}}catch{}}
  const link=document.createElement('a');link.className='button';link.href=`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.trailerQuery)}`;link.target='_blank';link.rel='noopener';link.innerHTML='<span>Search trailer on YouTube</span><span aria-hidden="true">↗</span>';content.append(link);message.textContent='A direct trailer becomes available when TMDB is connected.';
};
const closeTrailer=()=>{trailerDialog.close();trailerDialog.querySelector('[data-trailer-content]').replaceChildren();};
document.querySelector('[data-trailer-close]')?.addEventListener('click',closeTrailer);
trailerDialog?.addEventListener('click',event=>{if(event.target===trailerDialog)closeTrailer();});

const assistantForm=document.querySelector('[data-decision-form]');
const assistantResults=document.querySelector('[data-assistant-results]');
const assistantPanel=document.querySelector('[data-decision-results]');
const assistantReason=document.querySelector('[data-decision-reason]');
const assistantMemory=document.querySelector('[data-decision-memory]');
const assistantLibrarySearch=document.querySelector('[data-library-search]');
const assistantRefreshButton=document.querySelector('[data-assistant-refresh]');
const assistantStorageKey='cinemaDecisionMemory';
const providerMap={netflix:'8',prime:'119',disney:'337'};
function normalizePlatform(value){
  const normalized=String(value||'')
    .toLowerCase()
    .replace(/amazon/g,'')
    .replace(/video/g,'')
    .replace(/\+/g,' plus ')
    .replace(/\s+/g,' ')
    .trim();
  if(!normalized||normalized==='any')return '';
  if(normalized.includes('prime'))return 'prime';
  if(normalized.includes('netflix'))return 'netflix';
  if(normalized.includes('disney'))return 'disney';
  if(normalized.includes('cinema')||normalized.includes('theater')||normalized.includes('theatre')||normalized.includes('big screen'))return 'cinema';
  if(normalized.includes('library')||normalized.includes('watchlist'))return 'library';
  return normalized;
}
const platformValues=movie=>{
  const value=movie.platforms??movie.platform??movie.provider??movie.watchProvider??movie.watch_provider;
  if(Array.isArray(value))return value;
  if(typeof value==='string')return value.split(/[,/|]+/).map(item=>item.trim()).filter(Boolean);
  return [];
};
const assistantPosterPaths={
  'Arrival':'/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg',
  'Interstellar':'/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
  'Her':'/eCOtqtfvn7mxGl6nfmq4b1exJRc.jpg',
  'The Martian':'/fASz8A0yFE3QB6LgGoOfwvFSseV.jpg',
  'Blade Runner 2049':'/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
  'Before Sunrise':'/kf1Jb1c2JAOqjuzA3H4oDM263uB.jpg',
  'Whiplash':'/7fn624j5lj3xTme2SgiLCeuedmO.jpg',
  'Mad Max: Fury Road':'/hA2ple9q4qnwxp3hKVNhroipsir.jpg',
  'My Neighbor Totoro':'/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg',
  'Lost in Translation':'/3jCLmYDIIiSMPujbwygNpqdpM8N.jpg',
  'Spider-Man: Into the Spider-Verse':'/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg',
  'Cinema Paradiso':'/gCI2AeMV4IHSewhJkzsur5MEp6R.jpg',
  'The Pursuit of Happyness':'/lBYOKAMcxIvuk9s9hMuecB9dPBV.jpg',
  'Rocky':'/aYtBYWqCdUqcnoodWJdcTG3pFev.jpg',
  'La La Land':'/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',
  'About Time':'/ls6zswrOZVhCXQBh96DlbnLBajM.jpg',
  'Ex Machina':'/dmJW8IAKHKxFNiUnoDR7JfsK7Rp.jpg',
  'The Social Network':'/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg',
  'The Dark Knight':'/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
  'Inside Out':'/2H1TmgdfNtsKlU9jKdeNyYL5y8T.jpg',
  'Everything Everywhere All at Once':'/u68AjlvlutfEIcpmbYpKcdi09ut.jpg',
  'The Grand Budapest Hotel':'/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
  'Parasite':'/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
  'Your Name':'/q719jXXEzOoYaps6babgKnONONX.jpg',
  'The Apartment':'/hhSRt1KKfRT0yEhEtRW3qp31JFU.jpg',
  'Paddington 2':'/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg',
  'Sing Street':'/sUWpVlrvzU2SJbnVZqIeKulPKwk.jpg',
  'Amélie':'/nSxDa3M9aMvGVLoItzWTepQ5h5d.jpg',
  'Chef':'/hyp8EXDmO4dSC8V6Q5jU7gD1kcg.jpg',
  'The Secret Life of Walter Mitty':'/iAo1hlzsPV9XpYcLQp6Ud065tGO.jpg',
  'Soul':'/6jmppcaubzLF8wkXM36ganVISCo.jpg',
  'The Intouchables':'/1QU7HKgsQbGpzsJbJK4pAVQV9F5.jpg',
  'Little Miss Sunshine':'/niNdhTpPHSgw22tK0PLjQMV640v.jpg',
  'Billy Elliot':'/mYtqgWCJiXpDeZwjVcC3OQGD8IR.jpg',
  'Good Will Hunting':'/z2FnLKpFi1HPO7BEJxdkv6hpJSU.jpg',
  'Remember the Titans':'/825ohvC4wZ3gCuncCaqkWeQnK8h.jpg',
  'Hidden Figures':'/9lfz2W2uGjyow3am00rsPJ8iOyq.jpg',
  'Moneyball':'/4yIQq1e6iOcaZ5rLDG3lZBP3j7a.jpg',
  "The King's Speech":'/pVNKXVQFukBaCz6ML7GH3kiPlQP.jpg',
  'School of Rock':'/zXLXaepIBvFVLU25DH3wv4IPSbe.jpg',
  'Rudy':'/fAbfTCRpjHe2rprXBly55KL1dL9.jpg',
  'October Sky':'/umWrXCIWdcYPf764ruvMRCpG3cA.jpg',
  'The Truman Show':'/vuza0WqY239yBXOadKlGwJsZJFE.jpg',
  'Mission: Impossible - Fallout':'/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg',
  'The Fabelmans':'/h7llKkqkkJtJrTOaDLuVeUYDQ7I.jpg'
};
const assistantPosterImage=title=>assistantPosterPaths[title]?`${imageBase}${assistantPosterPaths[title]}`:assistantPosterFallback(title);
const slugForExternalMoviePage=(title,separator='-')=>String(title||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/&/g,' and ')
  .replace(/['’]/g,'')
  .replace(/[^a-z0-9]+/g,separator)
  .replace(new RegExp(`^\\${separator}+|\\${separator}+$`,'g'),'');
const assistantExternalMovieUrls={
  'Arrival':{imdb:'https://www.imdb.com/title/tt2543164/',rotten:'https://www.rottentomatoes.com/m/arrival_2016',metacritic:'https://www.metacritic.com/movie/arrival/'},
  'Interstellar':{imdb:'https://www.imdb.com/title/tt0816692/',rotten:'https://www.rottentomatoes.com/m/interstellar_2014',metacritic:'https://www.metacritic.com/movie/interstellar/'},
  'Her':{imdb:'https://www.imdb.com/title/tt1798709/',rotten:'https://www.rottentomatoes.com/m/her',metacritic:'https://www.metacritic.com/movie/her/'},
  'The Martian':{imdb:'https://www.imdb.com/title/tt3659388/',rotten:'https://www.rottentomatoes.com/m/the_martian',metacritic:'https://www.metacritic.com/movie/the-martian/'},
  'Blade Runner 2049':{imdb:'https://www.imdb.com/title/tt1856101/',rotten:'https://www.rottentomatoes.com/m/blade_runner_2049',metacritic:'https://www.metacritic.com/movie/blade-runner-2049/'},
  'Before Sunrise':{imdb:'https://www.imdb.com/title/tt0112471/',rotten:'https://www.rottentomatoes.com/m/before_sunrise',metacritic:'https://www.metacritic.com/movie/before-sunrise/'},
  'Whiplash':{imdb:'https://www.imdb.com/title/tt2582802/',rotten:'https://www.rottentomatoes.com/m/whiplash_2014',metacritic:'https://www.metacritic.com/movie/whiplash/'},
  'Mad Max: Fury Road':{imdb:'https://www.imdb.com/title/tt1392190/',rotten:'https://www.rottentomatoes.com/m/mad_max_fury_road',metacritic:'https://www.metacritic.com/movie/mad-max-fury-road/'},
  'My Neighbor Totoro':{imdb:'https://www.imdb.com/title/tt0096283/',rotten:'https://www.rottentomatoes.com/m/my_neighbor_totoro',metacritic:'https://www.metacritic.com/movie/my-neighbor-totoro/'},
  'Lost in Translation':{imdb:'https://www.imdb.com/title/tt0335266/',rotten:'https://www.rottentomatoes.com/m/lost_in_translation',metacritic:'https://www.metacritic.com/movie/lost-in-translation/'},
  'Spider-Man: Into the Spider-Verse':{imdb:'https://www.imdb.com/title/tt4633694/',rotten:'https://www.rottentomatoes.com/m/spider_man_into_the_spider_verse',metacritic:'https://www.metacritic.com/movie/spider-man-into-the-spider-verse/'},
  'Cinema Paradiso':{imdb:'https://www.imdb.com/title/tt0095765/',rotten:'https://www.rottentomatoes.com/m/cinema_paradiso',metacritic:'https://www.metacritic.com/movie/cinema-paradiso/'},
  'The Pursuit of Happyness':{imdb:'https://www.imdb.com/title/tt0454921/',rotten:'https://www.rottentomatoes.com/m/pursuit_of_happyness',metacritic:'https://www.metacritic.com/movie/the-pursuit-of-happyness/'},
  'Rocky':{imdb:'https://www.imdb.com/title/tt0075148/',rotten:'https://www.rottentomatoes.com/m/rocky',metacritic:'https://www.metacritic.com/movie/rocky/'},
  'La La Land':{imdb:'https://www.imdb.com/title/tt3783958/',rotten:'https://www.rottentomatoes.com/m/la_la_land',metacritic:'https://www.metacritic.com/movie/la-la-land/'},
  'About Time':{imdb:'https://www.imdb.com/title/tt2194499/',rotten:'https://www.rottentomatoes.com/m/about_time',metacritic:'https://www.metacritic.com/movie/about-time/'},
  'Ex Machina':{imdb:'https://www.imdb.com/title/tt0470752/',rotten:'https://www.rottentomatoes.com/m/ex_machina',metacritic:'https://www.metacritic.com/movie/ex-machina/'},
  'The Social Network':{imdb:'https://www.imdb.com/title/tt1285016/',rotten:'https://www.rottentomatoes.com/m/the_social_network',metacritic:'https://www.metacritic.com/movie/the-social-network/'},
  'The Dark Knight':{imdb:'https://www.imdb.com/title/tt0468569/',rotten:'https://www.rottentomatoes.com/m/the_dark_knight',metacritic:'https://www.metacritic.com/movie/the-dark-knight/'},
  'Inside Out':{imdb:'https://www.imdb.com/title/tt2096673/',rotten:'https://www.rottentomatoes.com/m/inside_out_2015',metacritic:'https://www.metacritic.com/movie/inside-out/'},
  'Everything Everywhere All at Once':{imdb:'https://www.imdb.com/title/tt6710474/',rotten:'https://www.rottentomatoes.com/m/everything_everywhere_all_at_once',metacritic:'https://www.metacritic.com/movie/everything-everywhere-all-at-once/'},
  'The Grand Budapest Hotel':{imdb:'https://www.imdb.com/title/tt2278388/',rotten:'https://www.rottentomatoes.com/m/the_grand_budapest_hotel',metacritic:'https://www.metacritic.com/movie/the-grand-budapest-hotel/'},
  'Parasite':{imdb:'https://www.imdb.com/title/tt6751668/',rotten:'https://www.rottentomatoes.com/m/parasite_2019',metacritic:'https://www.metacritic.com/movie/parasite/'},
  'Your Name':{imdb:'https://www.imdb.com/title/tt5311514/',rotten:'https://www.rottentomatoes.com/m/your_name_2017',metacritic:'https://www.metacritic.com/movie/your-name/'},
  'The Apartment':{imdb:'https://www.imdb.com/title/tt0053604/',rotten:'https://www.rottentomatoes.com/m/apartment',metacritic:'https://www.metacritic.com/movie/the-apartment/'},
  'Paddington 2':{imdb:'https://www.imdb.com/title/tt4468740/',rotten:'https://www.rottentomatoes.com/m/paddington_2',metacritic:'https://www.metacritic.com/movie/paddington-2/'},
  'Sing Street':{imdb:'https://www.imdb.com/title/tt3544112/',rotten:'https://www.rottentomatoes.com/m/sing_street',metacritic:'https://www.metacritic.com/movie/sing-street/'},
  'Amélie':{imdb:'https://www.imdb.com/title/tt0211915/',rotten:'https://www.rottentomatoes.com/m/amelie',metacritic:'https://www.metacritic.com/movie/amelie/'},
  'Chef':{imdb:'https://www.imdb.com/title/tt2883512/',rotten:'https://www.rottentomatoes.com/m/chef_2014',metacritic:'https://www.metacritic.com/movie/chef/'},
  'The Secret Life of Walter Mitty':{imdb:'https://www.imdb.com/title/tt0359950/',rotten:'https://www.rottentomatoes.com/m/the_secret_life_of_walter_mitty_2013',metacritic:'https://www.metacritic.com/movie/the-secret-life-of-walter-mitty/'},
  'Soul':{imdb:'https://www.imdb.com/title/tt2948372/',rotten:'https://www.rottentomatoes.com/m/soul_2020',metacritic:'https://www.metacritic.com/movie/soul/'},
  'The Intouchables':{imdb:'https://www.imdb.com/title/tt1675434/',rotten:'https://www.rottentomatoes.com/m/the_intouchables',metacritic:'https://www.metacritic.com/movie/the-intouchables/'},
  'Little Miss Sunshine':{imdb:'https://www.imdb.com/title/tt0449059/',rotten:'https://www.rottentomatoes.com/m/little_miss_sunshine',metacritic:'https://www.metacritic.com/movie/little-miss-sunshine/'},
  'Billy Elliot':{imdb:'https://www.imdb.com/title/tt0249462/',rotten:'https://www.rottentomatoes.com/m/billy_elliot',metacritic:'https://www.metacritic.com/movie/billy-elliot/'},
  'Good Will Hunting':{imdb:'https://www.imdb.com/title/tt0119217/',rotten:'https://www.rottentomatoes.com/m/good_will_hunting',metacritic:'https://www.metacritic.com/movie/good-will-hunting/'},
  'Remember the Titans':{imdb:'https://www.imdb.com/title/tt0210945/',rotten:'https://www.rottentomatoes.com/m/remember_the_titans',metacritic:'https://www.metacritic.com/movie/remember-the-titans/'},
  'Hidden Figures':{imdb:'https://www.imdb.com/title/tt4846340/',rotten:'https://www.rottentomatoes.com/m/hidden_figures',metacritic:'https://www.metacritic.com/movie/hidden-figures/'},
  'Moneyball':{imdb:'https://www.imdb.com/title/tt1210166/',rotten:'https://www.rottentomatoes.com/m/moneyball',metacritic:'https://www.metacritic.com/movie/moneyball/'},
  "The King's Speech":{imdb:'https://www.imdb.com/title/tt1504320/',rotten:'https://www.rottentomatoes.com/m/the_kings_speech',metacritic:'https://www.metacritic.com/movie/the-kings-speech/'},
  'School of Rock':{imdb:'https://www.imdb.com/title/tt0332379/',rotten:'https://www.rottentomatoes.com/m/school_of_rock',metacritic:'https://www.metacritic.com/movie/school-of-rock/'},
  'Rudy':{imdb:'https://www.imdb.com/title/tt0108002/',rotten:'https://www.rottentomatoes.com/m/rudy',metacritic:'https://www.metacritic.com/movie/rudy/'},
  'October Sky':{imdb:'https://www.imdb.com/title/tt0132477/',rotten:'https://www.rottentomatoes.com/m/october_sky',metacritic:'https://www.metacritic.com/movie/october-sky/'},
  'The Truman Show':{imdb:'https://www.imdb.com/title/tt0120382/',rotten:'https://www.rottentomatoes.com/m/truman_show',metacritic:'https://www.metacritic.com/movie/the-truman-show/'},
  'Mission: Impossible - Fallout':{imdb:'https://www.imdb.com/title/tt4912910/',rotten:'https://www.rottentomatoes.com/m/mission_impossible_fallout',metacritic:'https://www.metacritic.com/movie/mission-impossible---fallout/'},
  'The Fabelmans':{imdb:'https://www.imdb.com/title/tt14208870/',rotten:'https://www.rottentomatoes.com/m/the_fabelmans',metacritic:'https://www.metacritic.com/movie/the-fabelmans/'}
};
const assistantRatingLinks=(title,movie={})=>{
  const mapped=assistantExternalMovieUrls[title]||{};
  const query=encodeURIComponent(title);
  return {
    imdb:mapped.imdb||(movie.imdbId?`https://www.imdb.com/title/${movie.imdbId}/`:`https://www.imdb.com/find/?q=${query}`),
    rotten:mapped.rotten||`https://www.rottentomatoes.com/m/${slugForExternalMoviePage(title,'_')}`,
    metacritic:mapped.metacritic||`https://www.metacritic.com/movie/${slugForExternalMoviePage(title,'-')}/`
  };
};
const assistantRatingSources=(title,movie={})=>{
  const links=assistantRatingLinks(title,movie);
  return [
    {label:'IMDb',url:links.imdb,icon:'https://cdn.simpleicons.org/imdb/F5C518'},
    {label:'Rotten Tomatoes',url:links.rotten,icon:'https://cdn.simpleicons.org/rottentomatoes/FA320A'},
    {label:'Metacritic',url:links.metacritic,icon:'https://cdn.simpleicons.org/metacritic/00CE7C'}
  ];
};
const assistantFallback=[
  {title:'Arrival',year:'2016',runtime:116,rating:7.9,genreIds:[878,18],platforms:['Prime Video','Netflix','My own watchlist'],moods:['thoughtful','curious','inspired','moved'],age:'modern',overview:'A linguist works with the military to communicate with mysterious visitors, changing how she understands time and loss.',genre:'Sci-fi · Drama'},
  {title:'Interstellar',year:'2014',runtime:169,rating:8.7,genreIds:[878,18],platforms:['Amazon Prime Video','Cinema','My own watchlist'],moods:['inspired','thoughtful','moved'],age:'modern',overview:'A group of explorers travel through a wormhole to find humanity a future beyond Earth.',genre:'Sci-fi · Drama'},
  {title:'Her',year:'2013',runtime:126,rating:8.0,genreIds:[878,10749,18],platforms:['Netflix','Prime Video','My own watchlist'],moods:['lonely','romantic','curious','moved'],age:'modern',overview:'A lonely writer develops a relationship with an operating system that understands him deeply.',genre:'Sci-fi · Romance'},
  {title:'The Martian',year:'2015',runtime:144,rating:8.0,genreIds:[878,12],platforms:['Disney+','Amazon Prime Video','My own watchlist'],moods:['inspired','energized','happy'],age:'modern',overview:'An astronaut stranded on Mars uses science, humor, and persistence to survive.',genre:'Sci-fi · Adventure'},
  {title:'Blade Runner 2049',year:'2017',runtime:164,rating:8.0,genreIds:[878,18,53],platforms:['Netflix','Amazon Prime','My own watchlist'],moods:['thoughtful','curious','moved'],age:'new',overview:'A young blade runner uncovers a buried secret that could reshape society.',genre:'Sci-fi · Thriller'},
  {title:'Before Sunrise',year:'1995',runtime:101,rating:8.1,genreIds:[10749,18],platforms:['Prime Video','My own watchlist'],moods:['romantic','moved','relaxed'],age:'old',overview:'Two strangers meet on a train and spend one night walking and talking through Vienna.',genre:'Romance · Drama'},
  {title:'Whiplash',year:'2014',runtime:107,rating:8.4,genreIds:[18],platforms:['Netflix','Amazon Prime Video','My own watchlist'],moods:['energized','inspired','stressed'],age:'modern',overview:'A young drummer pushes himself under the pressure of a ruthless music teacher.',genre:'Drama'},
  {title:'Mad Max: Fury Road',year:'2015',runtime:121,rating:8.1,genreIds:[28,878],platforms:['Netflix','Prime','Cinema'],moods:['excited','energized'],age:'modern',overview:'A relentless desert chase turns survival into explosive visual cinema.',genre:'Action · Sci-fi'},
  {title:'My Neighbor Totoro',year:'1988',runtime:86,rating:8.1,genreIds:[16,10751],platforms:['netflix','library'],moods:['relaxed','happy','nostalgic'],age:'old',overview:'Two sisters discover gentle forest spirits while adapting to a new home.',genre:'Animation · Family'},
  {title:'Lost in Translation',year:'2003',runtime:102,rating:7.7,genreIds:[18,10749],platforms:['Amazon Prime','My own watchlist'],moods:['lonely','moved','relaxed'],age:'modern',overview:'Two strangers in Tokyo form a quiet connection during a moment of uncertainty.',genre:'Drama · Romance'},
  {title:'Spider-Man: Into the Spider-Verse',year:'2018',runtime:117,rating:8.4,genreIds:[16,28,12],platforms:['Netflix','Prime Video','My own watchlist'],moods:['happy','energized','inspired'],age:'new',overview:'Miles Morales discovers courage and identity across a visually explosive multiverse.',genre:'Animation · Action'},
  {title:'Cinema Paradiso',year:'1988',runtime:124,rating:8.5,genreIds:[18],platforms:['library'],moods:['nostalgic','moved','romantic'],age:'old',overview:'A filmmaker remembers the theater, mentor, and childhood that shaped his love of cinema.',genre:'Drama'},
  {title:'The Pursuit of Happyness',year:'2006',runtime:117,rating:8.0,genreIds:[18],platforms:['Netflix','Amazon Prime Video'],moods:['stressed','inspired','moved'],age:'modern',overview:'A struggling father turns pressure and uncertainty into persistence, hope, and discipline.',genre:'Drama'},
  {title:'Rocky',year:'1976',runtime:120,rating:8.1,genreIds:[18],platforms:['Prime Video','Cinema'],moods:['motivated','energized','inspired'],age:'old',overview:'An underdog boxer gets one chance to prove what effort and heart can become.',genre:'Drama'},
  {title:'La La Land',year:'2016',runtime:128,rating:8.0,genreIds:[10749,18,35],platforms:['Netflix','Prime Video'],moods:['romantic','happy','moved','nostalgic'],age:'modern',overview:'Two artists chase love and ambition through music, color, and bittersweet choices.',genre:'Romance · Drama'},
  {title:'About Time',year:'2013',runtime:123,rating:7.8,genreIds:[10749,35,18],platforms:['Amazon Prime Video','Netflix'],moods:['romantic','relaxed','happy','moved'],age:'modern',overview:'A time-travel romance about family, ordinary days, and choosing presence.',genre:'Romance · Comedy'},
  {title:'Ex Machina',year:'2015',runtime:108,rating:7.7,genreIds:[878,18,53],platforms:['Prime Video','My own watchlist'],moods:['thoughtful','curious','stressed'],age:'modern',overview:'A programmer tests an artificial intelligence and begins questioning control, desire, and consciousness.',genre:'Sci-fi · Thriller'},
  {title:'The Social Network',year:'2010',runtime:121,rating:7.7,genreIds:[18],platforms:['Netflix','Amazon Prime'],moods:['motivated','thoughtful','energized'],age:'modern',overview:'A sharp digital-age story about ambition, friendship, authorship, and power.',genre:'Drama'},
  {title:'The Dark Knight',year:'2008',runtime:152,rating:9.0,genreIds:[28,18,53],platforms:['Prime Video','Cinema'],moods:['excited','stressed','thoughtful'],age:'modern',overview:'A city, a hero, and a villain collide in a tense study of chaos and choice.',genre:'Action · Thriller'},
  {title:'Inside Out',year:'2015',runtime:95,rating:8.1,genreIds:[16,35,18],platforms:['Disney+','Prime Video'],moods:['sad','happy','moved','thoughtful'],age:'modern',overview:'Emotions become characters in a playful story about growing up and accepting sadness.',genre:'Animation · Comedy'},
  {title:'Everything Everywhere All at Once',year:'2022',runtime:140,rating:7.8,genreIds:[878,28,35],platforms:['Prime Video','Cinema'],moods:['excited','thoughtful','moved','energized'],age:'new',overview:'A multiverse adventure turns family conflict into wild, emotional, inventive cinema.',genre:'Sci-fi · Action'},
  {title:'The Grand Budapest Hotel',year:'2014',runtime:100,rating:8.1,genreIds:[35,18],platforms:['Disney+','Amazon Prime Video'],moods:['happy','nostalgic','relaxed'],age:'modern',overview:'A precise, playful hotel adventure wrapped in memory, style, and melancholy.',genre:'Comedy · Drama'},
  {title:'Parasite',year:'2019',runtime:132,rating:8.5,genreIds:[18,53,35],platforms:['Prime Video','Cinema'],moods:['thoughtful','stressed','excited'],age:'new',overview:'A tense social satire where class, space, and survival collide with unforgettable precision.',genre:'Thriller · Drama'},
  {title:'Your Name',year:'2016',runtime:106,rating:8.4,genreIds:[16,10749,18],platforms:['Netflix','Amazon Prime Video'],moods:['romantic','nostalgic','moved','curious'],age:'modern',overview:'Two teenagers mysteriously connected across distance and time search for each other.',genre:'Animation · Romance'},
  {title:'Paddington 2',year:'2017',runtime:104,rating:7.8,genreIds:[35,16,10751],platforms:['Netflix','Prime Video','Disney+'],moods:['happy','relaxed','inspired'],age:'modern',overview:'A generous bear turns prison, family, and community into a story about kindness and joy.',genre:'Comedy · Family'},
  {title:'Sing Street',year:'2016',runtime:106,rating:7.9,genreIds:[35,18,10402],platforms:['Netflix','Prime Video'],moods:['happy','inspired','energized'],age:'modern',overview:'A teenager starts a band, finds confidence, and uses music to imagine a bigger future.',genre:'Music · Comedy'},
  {title:'Amélie',year:'2001',runtime:122,rating:8.3,genreIds:[35,10749],platforms:['Prime Video','My own watchlist'],moods:['happy','romantic','relaxed'],age:'modern',overview:'A shy Parisian woman secretly improves other people’s lives and discovers her own courage.',genre:'Comedy · Romance'},
  {title:'Chef',year:'2014',runtime:114,rating:7.3,genreIds:[35,18],platforms:['Netflix','Prime Video'],moods:['happy','relaxed','inspired'],age:'modern',overview:'A chef rebuilds his creativity and family connection through food, travel, and friendship.',genre:'Comedy · Drama'},
  {title:'The Secret Life of Walter Mitty',year:'2013',runtime:114,rating:7.3,genreIds:[12,35,18],platforms:['Disney+','Prime Video'],moods:['lonely','inspired','happy'],age:'modern',overview:'A quiet dreamer leaves routine behind and finds courage through a life-changing journey.',genre:'Adventure · Drama'},
  {title:'Soul',year:'2020',runtime:101,rating:8.0,genreIds:[16,35,18],platforms:['Disney+'],moods:['thoughtful','happy','inspired','moved'],age:'new',overview:'A musician learns that purpose can be found in ordinary moments, not only achievement.',genre:'Animation · Drama'},
  {title:'The Intouchables',year:'2011',runtime:112,rating:8.5,genreIds:[18,35],platforms:['Netflix','Prime Video'],moods:['happy','inspired','moved'],age:'modern',overview:'An unlikely friendship brings humor, dignity, and new possibility to two very different lives.',genre:'Comedy · Drama'},
  {title:'Little Miss Sunshine',year:'2006',runtime:102,rating:7.8,genreIds:[35,18],platforms:['Prime Video','Netflix'],moods:['happy','inspired','moved'],age:'modern',overview:'A chaotic family road trip becomes a warm reminder that imperfect people can still support each other.',genre:'Comedy · Drama'},
  {title:'Billy Elliot',year:'2000',runtime:110,rating:7.7,genreIds:[18,35,10402],platforms:['Prime Video'],moods:['inspired','happy','moved'],age:'modern',overview:'A working-class boy discovers ballet and fights for a future larger than expectations allow.',genre:'Drama · Music'},
  {title:'Good Will Hunting',year:'1997',runtime:127,rating:8.3,genreIds:[18],platforms:['Netflix','Prime Video'],moods:['inspired','moved','thoughtful'],age:'old',overview:'A gifted young man learns that intelligence means little without trust, healing, and choice.',genre:'Drama'},
  {title:'Remember the Titans',year:'2000',runtime:113,rating:7.8,genreIds:[18],platforms:['Disney+','Prime Video'],moods:['inspired','energized','moved'],age:'modern',overview:'A football team becomes a story of leadership, unity, and people changing through pressure.',genre:'Sports · Drama'},
  {title:'Hidden Figures',year:'2016',runtime:127,rating:7.8,genreIds:[18,36],platforms:['Disney+','Prime Video'],moods:['inspired','thoughtful','moved'],age:'modern',overview:'Brilliant mathematicians push through prejudice to help change the future of space travel.',genre:'History · Drama'},
  {title:'Moneyball',year:'2011',runtime:134,rating:7.6,genreIds:[18],platforms:['Netflix','Prime Video'],moods:['inspired','thoughtful','energized'],age:'modern',overview:'A baseball manager challenges tradition by trusting new ideas and building differently.',genre:'Sports · Drama'},
  {title:"The King's Speech",year:'2010',runtime:118,rating:8.0,genreIds:[18,36],platforms:['Prime Video','Netflix'],moods:['inspired','moved'],age:'modern',overview:'A reluctant king faces fear and finds his voice through trust, patience, and discipline.',genre:'History · Drama'},
  {title:'School of Rock',year:'2003',runtime:110,rating:7.2,genreIds:[35,10402],platforms:['Netflix','Prime Video'],moods:['happy','energized','inspired'],age:'modern',overview:'A failed musician teaches kids confidence, teamwork, and joyful rebellion through rock music.',genre:'Comedy · Music'},
  {title:'Rudy',year:'1993',runtime:114,rating:7.5,genreIds:[18],platforms:['Prime Video'],moods:['inspired','energized','moved'],age:'old',overview:'An undersized dreamer refuses to let rejection define his place on the field.',genre:'Sports · Drama'},
  {title:'October Sky',year:'1999',runtime:108,rating:7.8,genreIds:[18,10751],platforms:['Disney+','Prime Video'],moods:['inspired','happy','moved'],age:'old',overview:'A coal-town student follows science, rockets, and hope toward a future he can choose.',genre:'Family · Drama'},
  {title:'The Truman Show',year:'1998',runtime:103,rating:8.2,genreIds:[35,18],platforms:['Netflix','Prime Video'],moods:['curious','inspired','thoughtful'],age:'old',overview:'A man questions the reality built around him and chooses freedom over comfortable illusion.',genre:'Comedy · Drama'},
  {title:'Mission: Impossible - Fallout',year:'2018',runtime:147,rating:7.4,genreIds:[28,12,53],platforms:['Prime Video','Netflix'],moods:['energized','excited','inspired'],age:'new',overview:'A high-risk mission turns precision, loyalty, and momentum into pure cinematic energy.',genre:'Action · Thriller'},
  {title:'The Fabelmans',year:'2022',runtime:151,rating:7.6,genreIds:[18],platforms:['Prime Video'],moods:['inspired','nostalgic','moved'],age:'new',overview:'A young filmmaker discovers how cinema transforms family memory, pain, and imagination.',genre:'Drama'}
].map(movie=>({...movie,release_date:`${movie.year}-01-01`,poster:assistantPosterImage(movie.title),trailerQuery:`${movie.title} official trailer`}));

const assistantDirectorHints={
  'Arrival':'Denis Villeneuve','Interstellar':'Christopher Nolan','Her':'Spike Jonze','The Martian':'Ridley Scott','Blade Runner 2049':'Denis Villeneuve','Before Sunrise':'Richard Linklater','Whiplash':'Damien Chazelle','Mad Max: Fury Road':'George Miller','My Neighbor Totoro':'Hayao Miyazaki','Lost in Translation':'Sofia Coppola','Spider-Man: Into the Spider-Verse':'Bob Persichetti Peter Ramsey Rodney Rothman','Cinema Paradiso':'Giuseppe Tornatore','The Pursuit of Happyness':'Gabriele Muccino','Rocky':'John G. Avildsen','La La Land':'Damien Chazelle','About Time':'Richard Curtis','Ex Machina':'Alex Garland','The Social Network':'David Fincher','The Dark Knight':'Christopher Nolan','Inside Out':'Pete Docter','Everything Everywhere All at Once':'Daniel Kwan Daniel Scheinert','The Grand Budapest Hotel':'Wes Anderson','Parasite':'Bong Joon Ho','Your Name':'Makoto Shinkai','Paddington 2':'Paul King','Sing Street':'John Carney','Amélie':'Jean-Pierre Jeunet','Chef':'Jon Favreau','The Secret Life of Walter Mitty':'Ben Stiller','Soul':'Pete Docter','The Intouchables':'Olivier Nakache Éric Toledano','Little Miss Sunshine':'Jonathan Dayton Valerie Faris','Billy Elliot':'Stephen Daldry','Good Will Hunting':'Gus Van Sant','Remember the Titans':'Boaz Yakin','Hidden Figures':'Theodore Melfi','Moneyball':'Bennett Miller',"The King's Speech":'Tom Hooper','School of Rock':'Richard Linklater','Rudy':'David Anspaugh','October Sky':'Joe Johnston','The Truman Show':'Peter Weir','Mission: Impossible - Fallout':'Christopher McQuarrie','The Fabelmans':'Steven Spielberg'
};
const defaultAssistantMemory=()=>({items:{},ratings:{},saved:[],watching:[],watched:[],movies:{}});
const assistantLifecycleOrder={saved:1,watching:2,watched:3,rated:4};
const assistantLifecycleLabels={saved:'Saved',watching:'Watching',watched:'Watched',rated:'Rated'};
const normalizeAssistantMemory=rawMemory=>{
  const memory={...defaultAssistantMemory(),...(rawMemory||{})};
  memory.items={...(memory.items||{})};
  memory.movies={...(memory.movies||{})};
  memory.ratings={...(memory.ratings||{})};
  const promote=(title,status)=>{
    if(!title)return;
    const current=memory.items[title]?.status||'';
    if(!current||assistantLifecycleOrder[status]>assistantLifecycleOrder[current])memory.items[title]={...(memory.items[title]||{}),status};
  };
  (memory.saved||[]).forEach(title=>promote(title,'saved'));
  (memory.watching||[]).forEach(title=>promote(title,'watching'));
  (memory.watched||[]).forEach(title=>promote(title,'watched'));
  Object.entries(memory.ratings||{}).forEach(([title,score])=>{if(Number(score)>0)promote(title,'rated');});
  Object.keys(memory.items).forEach(title=>{
    const status=memory.items[title].status;
    if(!assistantLifecycleOrder[status])delete memory.items[title];
  });
  memory.saved=Object.entries(memory.items).filter(([,item])=>item.status==='saved').map(([title])=>title);
  memory.watching=Object.entries(memory.items).filter(([,item])=>item.status==='watching').map(([title])=>title);
  memory.watched=Object.entries(memory.items).filter(([,item])=>item.status==='watched').map(([title])=>title);
  return memory;
};
const getAssistantMemory=()=>{
  try{return normalizeAssistantMemory(JSON.parse(localStorage.getItem(assistantStorageKey)||'{}'));}
  catch{return defaultAssistantMemory();}
};
const setAssistantMemory=memory=>{
  const normalized=normalizeAssistantMemory(memory);
  try{localStorage.setItem(assistantStorageKey,JSON.stringify(normalized));}catch{}
  updateAssistantMemory();
};
const assistantMovieSnapshot=movie=>{
  const normalized=normalizeMovie(movie);
  return {
    title:normalized.title,
    year:normalized.year,
    rating:Number(normalized.rating)||0,
    genre:normalized.genre,
    genreIds:normalized.genreIds||[],
    director:movie.director||movie.directors||movie.created_by?.[0]?.name||assistantDirectorHints[normalized.title]||'',
    moods:movie.moods||inferAssistantMoods(normalized),
    platforms:movie.platforms||[],
    runtime:movie.runtime||0,
    age:movie.age,
    overview:normalized.overview,
    poster:normalized.poster,
    trailerQuery:normalized.trailerQuery
  };
};
const rememberAssistantMovie=(memory,movie)=>{
  const snapshot=assistantMovieSnapshot(movie);
  memory.movies={...(memory.movies||{}),[snapshot.title]:snapshot};
  return memory;
};
const setAssistantMovieStatus=(memory,movie,status,rating)=>{
  const normalized=normalizeMovie(movie);
  rememberAssistantMovie(memory,movie);
  memory.items={...(memory.items||{})};
  memory.ratings={...(memory.ratings||{})};
  if(status){
    memory.items[normalized.title]={...(memory.items[normalized.title]||{}),status};
  }else{
    delete memory.items[normalized.title];
  }
  if(status==='rated'&&Number(rating)>0){
    memory.ratings[normalized.title]=Number(rating);
  }else if(status!=='rated'){
    delete memory.ratings[normalized.title];
  }
  return normalizeAssistantMemory(memory);
};
const findAssistantMovieByTitle=title=>{
  const normalizedTitle=String(title||'').toLowerCase();
  const remembered=getAssistantMemory().movies?.[title];
  if(remembered)return remembered;
  return assistantFallback.find(movie=>movie.title.toLowerCase()===normalizedTitle)||
    {title,year:'TBA',rating:0,genre:'Film',overview:'Saved from your movie memory. Run the assistant again to refresh full details.',poster:assistantPosterImage(title),trailerQuery:`${title} official trailer`};
};
const removeAssistantMemoryItem=(type,title)=>{
  const next=getAssistantMemory();
  next.items={...(next.items||{})};
  next.ratings={...(next.ratings||{})};
  next.movies={...(next.movies||{})};
  delete next.items[title];
  delete next.ratings[title];
  delete next.movies[title];
  setAssistantMemory(next);
};
const assistantLibrarySearchText=movie=>{
  const normalized=normalizeMovie(movie);
  return [
    normalized.title,
    normalized.year,
    normalized.genre,
    (movie.genreIds||[]).map(id=>genreNames[id]).join(' '),
    movie.director||assistantDirectorHints[normalized.title],
    (movie.platforms||[]).join(' '),
    (movie.moods||[]).join(' ')
  ].join(' ').toLowerCase();
};
const createMemoryListItem=(title,{type,rating,movie}={})=>{
  const item=document.createElement('li');
  item.className='taste-memory-item';
  const titleButton=document.createElement('button');
  titleButton.type='button';
  titleButton.className='taste-memory-title';
  titleButton.textContent=title;
  titleButton.addEventListener('click',()=>openMovieDetails(findAssistantMovieByTitle(title)));
  const meta=document.createElement('span');
  meta.className='taste-memory-meta';
  const year=movie?.year&&movie.year!=='TBA'?` · ${movie.year}`:'';
  meta.textContent=rating?`${rating}/10${year}`:`${assistantLifecycleLabels[type]||'Saved'}${year}`;
  const remove=document.createElement('button');
  remove.type='button';
  remove.className='taste-memory-remove';
  remove.textContent='Remove';
  remove.addEventListener('click',()=>removeAssistantMemoryItem(type,title));
  item.append(titleButton,meta,remove);
  return item;
};
const createMemoryGroup=(label,items,type,ratings={},movies={})=>{
  const section=document.createElement('section');
  section.className='taste-memory-group';
  const heading=document.createElement('h4');
  heading.textContent=`${label} (${items.length})`;
  const list=document.createElement('ul');
  if(items.length){
    items.forEach(title=>list.append(createMemoryListItem(title,{type,rating:ratings[title],movie:movies[title]})));
  }else{
    const empty=document.createElement('li');
    empty.className='taste-memory-empty';
    empty.textContent=`No ${label.toLowerCase()} yet.`;
    list.append(empty);
  }
  section.append(heading,list);
  return section;
};
const updateAssistantMemory=()=>{
  if(!assistantMemory)return;
  const memory=getAssistantMemory();
  const query=assistantLibrarySearch?.value.trim().toLowerCase()||'';
  const movies=memory.movies||{};
  const matches=title=>!query||assistantLibrarySearchText(movies[title]||findAssistantMovieByTitle(title)).includes(query)||String(title).toLowerCase().includes(query);
  const ratings=Object.entries(memory.ratings||{}).filter(([title,score])=>Number(score)>0&&matches(title)).sort((a,b)=>b[1]-a[1]);
  const saved=[...(memory.saved||[])].filter(matches);
  const watching=[...(memory.watching||[])].filter(matches);
  const watched=[...(memory.watched||[])].filter(matches);
  const allCount=Object.keys(memory.items||{}).length;
  assistantMemory.replaceChildren();
  if(!allCount){assistantMemory.textContent='Save, watch, or rate movies and this library will guide your recommendations.';return;}
  if(!ratings.length&&!saved.length&&!watching.length&&!watched.length){assistantMemory.textContent='No library items match that search.';return;}
  const favorite=ratings[0]?.[0];
  const summary=document.createElement('p');
  summary.className='taste-memory-summary';
  summary.textContent=`Library active: ${ratings.length} rated, ${watched.length} watched, ${watching.length} watching, ${saved.length} saved${favorite?`. Strongest taste signal: “${favorite}”.`:'.'}`;
  assistantMemory.append(
    summary,
    createMemoryGroup('Saved',saved,'saved',memory.ratings||{},movies),
    createMemoryGroup('Watching',watching,'watching',memory.ratings||{},movies),
    createMemoryGroup('Watched',watched,'watched',memory.ratings||{},movies),
    createMemoryGroup('Rated',ratings.map(([title])=>title),'rated',memory.ratings||{},movies)
  );
};
function getAssistantFilters(){
  return Object.fromEntries(new FormData(assistantForm).entries());
}
const assistantValues=getAssistantFilters;
const movieMatchesPlatform=(movie,platform)=>{
  const selected=normalizePlatform(platform);
  if(!selected)return true;
  return platformValues(movie).some(value=>{
    const normalized=normalizePlatform(value);
    return normalized&&(
      normalized.includes(selected)||
      selected.includes(normalized)
    );
  });
};
const movieMatchesAge=(movie,age)=>{
  const year=Number(movie.year||(movie.release_date||'').slice(0,4)||0);
  if(age==='new')return year>=2018;
  if(age==='modern')return year>=2000&&year<2018;
  if(age==='old')return year>0&&year<2000;
  return true;
};
const movieMatchesTime=(movie,time)=>{
  const runtime=Number(movie.runtime||0);
  if(!runtime||time==='any')return true;
  if(time==='short')return runtime<=100;
  if(time==='medium')return runtime>95&&runtime<=140;
  if(time==='long')return runtime>140;
  return true;
};
const assistantMoodProfiles={
  happy:{
    genres:[35,16,10751,12],
    include:['joy','funny','comedy','kindness','friendship','family','warm','playful','adventure','uplifting','optimistic','celebration','music','colorful','charming'],
    avoid:['grief','death','murder','war','trauma','bleak','revenge','torture','horror','serial killer'],
    bridge:{sad:['healing','family','friendship','hope','kindness'],lonely:['friendship','community','connection','family'],stressed:['gentle','funny','comfort','warm']}
  },
  inspired:{
    genres:[18,12,28,878,36,99],
    include:['hope','dream','survive','courage','underdog','mission','journey','future','hero','persistence','ambition','discover','training','challenge','overcome','vision','purpose','achievement'],
    avoid:['hopeless','despair','nihilistic','torture','slasher'],
    bridge:{sad:['hope','healing','overcome','family'],lonely:['journey','connection','self-discovery','purpose'],stressed:['focus','discipline','training','achievement']}
  },
  relaxed:{
    genres:[16,35,10751,99,12],
    include:['gentle','peaceful','nature','comfort','healing','family','warm','quiet','simple','friendship','home','beautiful','calm','food'],
    avoid:['horror','violent','murder','terror','war','crime','nightmare','revenge','explosive'],
    bridge:{stressed:['gentle','comfort','peaceful','healing'],sad:['warm','family','healing'],lonely:['friendship','home','connection']}
  },
  moved:{
    genres:[18,10749,16,36],
    include:['family','healing','loss','memory','relationship','tender','emotional','father','mother','daughter','son','love','forgiveness','sacrifice'],
    avoid:['slasher','gross-out','torture'],
    bridge:{sad:['healing','memory','family','forgiveness'],lonely:['relationship','connection','tender'],thoughtful:['memory','identity','meaning']}
  },
  energized:{
    genres:[28,12,35,18,10402],
    include:['action','mission','race','fight','adventure','music','training','competition','chase','escape','spectacle','battle','energy','momentum','team'],
    avoid:['slow','quiet','meditation','grief'],
    bridge:{stressed:['focus','mission','training'],sad:['comeback','team','victory'],lonely:['team','friendship','adventure']}
  },
  romantic:{
    genres:[10749,18,35],
    include:['love','romance','relationship','heart','couple','wedding','chance','together','intimacy','date','chemistry','affection'],
    avoid:['murder','war','monster','apocalypse','torture'],
    bridge:{lonely:['connection','relationship','chance','together'],sad:['healing','love','tender'],happy:['romance','celebration','chemistry']}
  },
  curious:{
    genres:[878,99,18,53,36],
    include:['mystery','truth','identity','time','future','question','secret','consciousness','language','society','human','discover','experiment','unknown','investigation'],
    avoid:['gross-out','empty spectacle'],
    bridge:{thoughtful:['identity','truth','question','meaning'],stressed:['puzzle','investigation','discover'],lonely:['identity','connection','unknown']}
  },
  hopeful:{
    genres:[18,35,10751,16,36],
    include:['hope','healing','future','family','friendship','kindness','forgiveness','overcome','survive','second chance','home','together'],
    avoid:['hopeless','despair','nihilistic','bleak','torture'],
    bridge:{sad:['hope','healing','forgiveness','family'],lonely:['connection','friendship','home'],angry:['forgiveness','second chance','kindness']}
  },
  thoughtful:{
    genres:[18,878,99,36,53],
    include:['meaning','identity','truth','memory','society','choice','language','human','question','consciousness','moral','philosophy'],
    avoid:['empty spectacle','gross-out'],
    bridge:{bored:['mystery','question','truth'],curious:['identity','meaning','truth'],angry:['moral','choice','society']}
  },
  emotional:{
    genres:[18,10749,16,36],
    include:['family','loss','love','memory','tender','relationship','healing','sacrifice','forgiveness','mother','father','daughter','son'],
    avoid:['slasher','gross-out','torture'],
    bridge:{sad:['healing','family','forgiveness'],lonely:['connection','relationship','tender'],tired:['gentle','tender','memory']}
  },
  motivated:{
    genres:[18,28,12,36,10402],
    include:['training','ambition','discipline','mission','challenge','underdog','achievement','purpose','courage','team','competition','dream'],
    avoid:['hopeless','static','aimless'],
    bridge:{tired:['purpose','momentum','training'],bored:['challenge','mission','competition'],stressed:['focus','discipline','purpose']}
  },
  excited:{
    genres:[28,12,878,53,35],
    include:['action','adventure','chase','mission','escape','battle','spectacle','fast','danger','momentum','team','race'],
    avoid:['static','meditation','quiet'],
    bridge:{bored:['adventure','spectacle','mission'],tired:['momentum','team','race'],happy:['adventure','comedy','spectacle']}
  },
  amazed:{
    genres:[878,12,16,14,99],
    include:['wonder','spectacle','world','visual','future','space','dream','discover','mystery','imagination','epic','extraordinary'],
    avoid:['small','static','ordinary'],
    bridge:{bored:['wonder','spectacle','discover'],curious:['mystery','future','world'],sad:['wonder','imagination','dream']}
  },
  entertained:{
    genres:[35,28,12,16,10751],
    include:['funny','comedy','adventure','playful','fun','team','music','fast','charming','friendship','celebration','spectacle'],
    avoid:['bleak','slow','torture','grief-heavy'],
    bridge:{bored:['funny','adventure','fast'],tired:['playful','charming','music'],angry:['comedy','friendship','fun']}
  }
};
const currentMoodAvoid={
  sad:['hopeless','despair','bleak','trauma','grief-heavy','suicide'],
  lonely:['isolation','alienation','abandonment','hopeless'],
  stressed:['horror','terror','violent','murder','crime','nightmare','torture','chaos'],
  angry:['revenge','cruel','torture','nihilistic','rage'],
  bored:['slow','static','empty','aimless'],
  tired:['exhausting','chaos','violent','dense','grim'],
  happy:['bleak','trauma','nihilistic'],
  curious:[],
  excited:['slow','static']
};
const normalizeAssistantText=movie=>`${movie.title||''} ${movie.overview||''} ${movie.genre||''}`.toLowerCase();
const hasAssistantKeyword=(text,keyword)=>text.includes(String(keyword).toLowerCase());
const assistantKeywordScore=(text,keywords=[],weight=1)=>keywords.reduce((score,keyword)=>score+(hasAssistantKeyword(text,keyword)?weight:0),0);
const getAssistantTargetProfile=answers=>assistantMoodProfiles[answers.targetMood]||{genres:[],include:[],avoid:[],bridge:{}};
const moodTransitionScore=(movie,answers={})=>{
  const normalized=normalizeMovie(movie);
  const text=normalizeAssistantText(normalized);
  const genreIds=normalized.genreIds||[];
  const moods=movie.moods||[];
  if(answers.currentMood==='any'&&answers.targetMood==='any')return 0;
  const profile=getAssistantTargetProfile(answers);
  const bridgeWords=profile.bridge?.[answers.currentMood]||[];
  const currentAvoid=currentMoodAvoid[answers.currentMood]||[];
  let score=0;
  if(answers.targetMood!=='any'&&moods.includes(answers.targetMood))score+=14;
  if(answers.currentMood!=='any'&&moods.includes(answers.currentMood)&&answers.currentMood!==answers.targetMood)score+=2;
  score+=assistantKeywordScore(text,profile.include,2.1);
  score+=assistantKeywordScore(text,bridgeWords,2.8);
  score+=profile.genres.reduce((total,genreId)=>total+(genreIds.includes(genreId)?2.4:0),0);
  score-=assistantKeywordScore(text,profile.avoid,4);
  score-=assistantKeywordScore(text,currentAvoid,3.5);
  if(['sad','lonely','stressed'].includes(answers.currentMood)&&['happy','inspired','relaxed','energized'].includes(answers.targetMood)){
    if(moods.includes('stressed'))score-=3.5;
    if(moods.includes('lonely')&&!['romantic','moved'].includes(answers.targetMood))score-=2;
    if(moods.includes('sad')&&answers.targetMood==='happy')score-=3;
  }
  return score;
};
const movieMatchesMood=(movie,answers)=>{
  if(answers.targetMood==='any')return true;
  const moods=movie.moods||[];
  if(!moods.length)return moodTransitionScore(movie,answers)>=7;
  return moods.includes(answers.targetMood)||moodTransitionScore(movie,answers)>=8;
};
const inferAssistantMoods=movie=>{
  const genreIds=movie.genreIds||movie.genre_ids||[];
  const text=`${movie.title||''} ${movie.overview||''} ${movie.genre||''}`.toLowerCase();
  const moods=new Set();
  if(genreIds.includes(35)||genreIds.includes(16)||genreIds.includes(10751))moods.add('happy').add('relaxed');
  if(genreIds.includes(10749))moods.add('romantic').add('moved');
  if(genreIds.includes(18))moods.add('thoughtful').add('moved');
  if(genreIds.includes(878)||genreIds.includes(99)||genreIds.includes(36))moods.add('thoughtful').add('curious');
  if(genreIds.includes(28)||genreIds.includes(12))moods.add('excited').add('energized');
  if(genreIds.includes(53)||genreIds.includes(27)||genreIds.includes(80))moods.add('stressed').add('excited');
  if(/\b(joy|funny|comedy|kindness|friendship|family|warm|playful|uplifting|celebration)\b/.test(text))moods.add('happy');
  if(/\b(gentle|peaceful|nature|comfort|healing|quiet|simple|home|food)\b/.test(text))moods.add('relaxed');
  if(/\b(love|romance|relationship|heart|wedding|couple|chemistry|together)\b/.test(text))moods.add('romantic');
  if(/\b(lonely|alone|isolation|connection|friendship|family|self-discovery)\b/.test(text))moods.add('lonely').add('moved');
  if(/\b(dream|hope|survive|journey|future|mission|hero|courage|underdog|persistence|overcome|training|achievement|ambition)\b/.test(text))moods.add('inspired').add('hopeful');
  if(/\b(chase|race|fight|battle|escape|competition|team|music|momentum)\b/.test(text))moods.add('energized').add('excited');
  if(/\b(purpose|discipline|challenge|goal|voice|confidence|leadership)\b/.test(text))moods.add('motivated');
  if(/\b(wonder|spectacle|space|world|imagination|epic|extraordinary)\b/.test(text))moods.add('amazed');
  if(/\b(fun|funny|playful|charming|celebration|adventure)\b/.test(text))moods.add('entertained');
  if(/\b(tender|emotional|sacrifice|forgiveness|loss)\b/.test(text))moods.add('emotional');
  if(/\b(memory|past|childhood|home|return)\b/.test(text))moods.add('nostalgic');
  if(/\b(mystery|secret|question|truth|identity)\b/.test(text))moods.add('curious').add('thoughtful');
  return [...moods];
};
const enrichAssistantMovie=(rawMovie,platform='')=>{
  const movie=normalizeMovie(rawMovie);
  movie.moods=rawMovie.moods&&rawMovie.moods.length?rawMovie.moods:inferAssistantMoods(movie);
  movie.runtime=rawMovie.runtime||movie.runtime||0;
  movie.platforms=platform?[platform]:(rawMovie.platforms||(rawMovie.platform?[rawMovie.platform]:[]));
  movie.age=rawMovie.age;
  return movie;
};
const sharedCount=(left=[],right=[])=>{
  const rightSet=new Set(right);
  return left.filter(item=>rightSet.has(item)).length;
};
const movieSimilarityScore=(candidate,memoryMovie)=>{
  const candidateMovie=normalizeMovie(candidate);
  const remembered=normalizeMovie(memoryMovie);
  const genreOverlap=sharedCount(candidateMovie.genreIds||[],remembered.genreIds||[]);
  const moodOverlap=sharedCount(candidate.moods||[],memoryMovie.moods||[]);
  const textMatch=normalizeAssistantText(candidateMovie).includes(String(remembered.title||'').toLowerCase())?1:0;
  return genreOverlap*1.6+moodOverlap*2.2+textMatch;
};
const ratingTasteWeight=rating=>{
  const score=Number(rating||0);
  if(score>=9)return 5;
  if(score>=8)return 3.6;
  if(score>=7)return 2.2;
  if(score>=6)return .8;
  if(score>=5)return 0;
  if(score>=3)return -2.8;
  if(score>0)return -4.2;
  return 0;
};
const tasteMemoryScore=(movie,memory)=>{
  // Taste Memory logic:
  // 1) A watched movie is stored with genre/mood data.
  // 2) A 1–10 rating turns that watched movie into a stronger preference signal.
  // 3) High ratings boost similar genres/moods; low ratings penalize similar genres/moods.
  // 4) Exact watched titles are penalized so the assistant suggests new choices, not repeats.
  const items=memory.items||{};
  const watched=new Set([...(memory.watched||[]),...Object.entries(items).filter(([,item])=>['watched','rated'].includes(item.status)).map(([title])=>title)]);
  const saved=new Set(memory.saved||[]);
  const rememberedMovies=memory.movies||{};
  let score=0;
  if(watched.has(movie.title))score-=6;
  if(saved.has(movie.title)&&!watched.has(movie.title))score+=.8;
  Object.entries(rememberedMovies).forEach(([title,remembered])=>{
    const similarity=movieSimilarityScore(movie,remembered);
    if(!similarity)return;
    const rating=Number(memory.ratings?.[title]||0);
    if(rating>0){
      score+=similarity*ratingTasteWeight(rating);
    }else if(watched.has(title)){
      score+=similarity*.35;
    }else if(saved.has(title)){
      score+=similarity*.18;
    }
  });
  return score;
};
const runtimePreferenceScore=(movie,time)=>{
  const runtime=Number(movie.runtime||0);
  if(time==='any'||!runtime)return 0;
  if(time==='short')return runtime<=100?8:Math.max(-7,(110-runtime)/5);
  if(time==='medium')return runtime>=95&&runtime<=140?8:Math.max(-7,8-(Math.min(Math.abs(runtime-110),Math.abs(runtime-130))*.25));
  if(time==='long')return runtime>140?8:Math.max(-6,(runtime-130)/5);
  return 0;
};
const genrePreferenceScore=(movie,genre)=>{
  if(genre==='any')return 0;
  const genreIds=movie.genreIds||movie.genre_ids||[];
  return genreIds.includes(Number(genre))?10:-3;
};
const platformPreferenceScore=(movie,platform)=>normalizePlatform(platform)?(movieMatchesPlatform(movie,platform)?8:-4):0;
const releasePreferenceScore=(movie,age)=>age==='any'?0:(movieMatchesAge(movie,age)?7:-4);
const scoreAssistantMovie=(movie,answers,memory)=>{
  let score=Number(movie.rating||movie.vote_average||0)*1.2;
  score+=genrePreferenceScore(movie,answers.genre);
  score+=runtimePreferenceScore(movie,answers.time);
  score+=releasePreferenceScore(movie,answers.age);
  score+=platformPreferenceScore(movie,answers.platform);
  score+=moodTransitionScore(movie,answers);
  score+=tasteMemoryScore(movie,memory);
  return score;
};
const assistantExplanation=(answers,movies)=>{
  const genreLabel=answers.genre==='any'?'a surprise genre':(genreNames[answers.genre]||'your selected genre');
  const titles=movies.map(movie=>movie.title).join(', ');
  const memory=getAssistantMemory();
  const topRated=Object.entries(memory.ratings||{}).filter(([,score])=>Number(score)>=8).map(([title])=>title)[0];
  return `Mood path: ${answers.currentMood} → ${answers.targetMood}. These films are ranked by mood transition, ${genreLabel}, runtime, platform, release preference, and My Library signals. ${topRated?`Because you rated “${topRated}” highly, similar films receive extra weight. `:''}Best choices: ${titles}.`;
};
const closestAssistantExplanation=(answers,movies)=>{
  const titles=movies.map(movie=>movie.title).join(', ');
  return `Closest mood path: ${answers.currentMood} → ${answers.targetMood}. The engine relaxed weaker preferences and kept the highest scoring mood matches: ${titles}.`;
};
const fetchAssistantMovies=async answers=>{
  if(!token)throw new Error('TMDB token not configured');
  const sortOptions=['popularity.desc','vote_average.desc','revenue.desc','primary_release_date.desc'];
  const params={include_adult:'false',sort_by:sortOptions[assistantVariant%sortOptions.length],'vote_count.gte':assistantVariant%2?80:120};
  const firstPage=((assistantVariant*7)%70)+1;
  const pages=[firstPage,firstPage+3,firstPage+9,firstPage+17,firstPage+28,firstPage+39].map(page=>((page-1)%80)+1);
  const responses=await Promise.all(pages.map(page=>tmdb('/discover/movie',{...params,page:String(page)}).catch(()=>({results:[]}))));
  const seen=new Set();
  return responses.flatMap(data=>data.results||[])
    .filter(movie=>movie.poster_path)
    .filter(movie=>{
      const key=movie.id||movie.title;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .map(movie=>enrichAssistantMovie(movie,''));
};
const openMovieDetails=async movie=>{
  const normalized=normalizeMovie(movie);
  if(normalized.id&&token&&!normalized.imdbId){
    try{
      const externalIds=await tmdb(`/movie/${normalized.id}/external_ids`);
      normalized.imdbId=externalIds.imdb_id||'';
    }catch{}
  }
  const content=trailerDialog.querySelector('[data-trailer-content]');
  const message=trailerDialog.querySelector('[data-trailer-message]');
  content.replaceChildren();
  const detail=document.createElement('article');
  detail.className='movie-detail-card';
  const title=document.createElement('h3'); title.textContent=normalized.title;
  const meta=document.createElement('p'); meta.className='movie-detail-meta'; meta.textContent=`${normalized.year} · ${normalized.genre||'Film'} · ${normalized.rating==='0.0'?'Not rated':`★ ${normalized.rating}`}`;
  const storyLabel=document.createElement('span'); storyLabel.className='movie-detail-label'; storyLabel.textContent='Short story';
  const overview=document.createElement('p'); overview.className='movie-detail-story'; overview.textContent=normalized.overview;
  const ratings=document.createElement('div'); ratings.className='critic-ratings critic-logo-row'; ratings.setAttribute('aria-label',`External rating websites for ${normalized.title}`);
  assistantRatingSources(normalized.title,normalized).forEach(({label,url,icon})=>{
    const link=document.createElement('a');
    link.href=url;
    link.target='_blank';
    link.rel='noopener';
    link.className='critic-rating-link';
    link.setAttribute('aria-label',`Open ${normalized.title} on ${label}`);
    const logo=document.createElement('img');
    logo.src=icon;
    logo.alt=label;
    logo.loading='lazy';
    logo.decoding='async';
    link.append(logo);
    ratings.append(link);
  });
  const actions=document.createElement('div'); actions.className='assistant-actions detail-actions';
  const save=document.createElement('button'); save.type='button'; save.textContent='Save';
  const watching=document.createElement('button'); watching.type='button'; watching.textContent='Watching';
  const watched=document.createElement('button'); watched.type='button'; watched.textContent='Watched';
  const trailer=document.createElement('button'); trailer.type='button'; trailer.textContent='Trailer';
  const ratingPanel=document.createElement('div'); ratingPanel.className='watched-rating-panel'; ratingPanel.hidden=true;
  const ratingQuestion=document.createElement('p'); ratingQuestion.textContent='How would you rate this movie?';
  const ratingScale=document.createElement('div'); ratingScale.className='watched-rating-scale';
  const ratingStatus=document.createElement('small'); ratingStatus.className='watched-rating-status';
  Array.from({length:10},(_,index)=>index+1).forEach(score=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=String(score);
    button.setAttribute('aria-label',`Rate ${normalized.title} ${score} out of 10`);
    button.addEventListener('click',()=>{
      const next=getAssistantMemory();
      setAssistantMemory(setAssistantMovieStatus(next,movie,'rated',score));
      sync();
      ratingStatus.textContent=`Your rating: ${score}/10`;
    });
    ratingScale.append(button);
  });
  ratingPanel.append(ratingQuestion,ratingScale,ratingStatus);
  const sync=()=>{
    const memory=getAssistantMemory();
    const status=memory.items?.[normalized.title]?.status||'';
    const userRating=Number(memory.ratings?.[normalized.title]||0);
    save.classList.toggle('is-active',status==='saved');
    watching.classList.toggle('is-active',status==='watching');
    watched.classList.toggle('is-active',status==='watched'||status==='rated');
    ratingPanel.hidden=!(status==='watched'||status==='rated');
    ratingScale.querySelectorAll('button').forEach((button,index)=>button.classList.toggle('is-active',index+1===userRating));
    ratingStatus.textContent=userRating?`Your rating: ${userRating}/10`:'';
  };
  save.addEventListener('click',()=>{const next=getAssistantMemory();const isActive=next.items?.[normalized.title]?.status==='saved';setAssistantMemory(isActive?setAssistantMovieStatus(next,movie,''):setAssistantMovieStatus(next,movie,'saved'));sync();});
  watching.addEventListener('click',()=>{const next=getAssistantMemory();const isActive=next.items?.[normalized.title]?.status==='watching';setAssistantMemory(isActive?setAssistantMovieStatus(next,movie,''):setAssistantMovieStatus(next,movie,'watching'));sync();});
  watched.addEventListener('click',()=>{const next=getAssistantMemory();const status=next.items?.[normalized.title]?.status;setAssistantMemory(status==='watched'||status==='rated'?setAssistantMovieStatus(next,movie,''):setAssistantMovieStatus(next,movie,'watched'));sync();});
  trailer.addEventListener('click',()=>openTrailer(normalized));
  actions.append(save,watching,watched,trailer); detail.append(title,meta,storyLabel,overview,ratings,actions,ratingPanel); content.append(detail); message.textContent=''; sync(); trailerDialog.showModal();
};
const createAssistantCard=rawMovie=>{
  const movie=normalizeMovie(rawMovie);
  const poster=document.createElement('button'); poster.type='button'; poster.className='wall-poster'; poster.setAttribute('aria-label',`View details for ${movie.title}`);
  const image=document.createElement('img'); image.src=movie.poster||assistantPosterImage(movie.title); image.alt=`Poster for ${movie.title}`; image.loading='eager'; image.decoding='async'; image.addEventListener('error',()=>{image.src=assistantPosterFallback(movie.title)},{once:true});
  const overlay=document.createElement('span'); overlay.className='wall-poster-overlay'; overlay.innerHTML=`<strong>${movie.title}</strong><small>View Details</small>`;
  poster.append(image,overlay); poster.addEventListener('click',()=>openMovieDetails({...rawMovie,...movie}));
  return poster;
};
let assistantRenderRequest=0;
let assistantVariant=0;
let lastAssistantSignature='';
let lastAssistantFilterSignature='';
let recentAssistantTitles=[];
const shuffledMovies=(movies,variant=0)=>movies.map((movie,index)=>({movie,sort:Math.random()+((variant%11)*0.0001)+(index*0.00001)})).sort((a,b)=>a.sort-b.sort).map(item=>item.movie);
const selectAssistantMovies=(exactRanked,closeRanked,{different=false}={})=>{
  const recent=new Set(recentAssistantTitles);
  const enoughFresh=[...exactRanked,...closeRanked].filter(movie=>!recent.has(normalizeMovie(movie).title)).length>=5;
  const avoidRecent=movie=>!enoughFresh||!recent.has(normalizeMovie(movie).title);
  const exactPool=(different?shuffledMovies(exactRanked,assistantVariant):exactRanked).filter(avoidRecent);
  const closePool=(different?shuffledMovies(closeRanked,assistantVariant+3):closeRanked).filter(avoidRecent);
  let selection=[...exactPool.slice(0,5),...closePool].slice(0,5);
  const combined=[...exactRanked,...closeRanked];
  if(selection.length<5)selection=[...selection,...shuffledMovies(combined,assistantVariant+5).filter(movie=>!selection.some(selected=>normalizeMovie(selected).title===normalizeMovie(movie).title))].slice(0,5);
  for(let attempt=0;attempt<6&&combined.length>5&&selection.map(movie=>normalizeMovie(movie).title).join('|')===lastAssistantSignature;attempt++){
    selection=shuffledMovies(combined,assistantVariant+attempt+7).slice(0,5);
  }
  lastAssistantSignature=selection.map(movie=>normalizeMovie(movie).title).join('|');
  recentAssistantTitles=[...selection.map(movie=>normalizeMovie(movie).title),...recentAssistantTitles].slice(0,25);
  return selection;
};
const uniqueAssistantMovies=movies=>{
  const seen=new Set();
  return movies.filter(movie=>{
    const title=normalizeMovie(movie).title;
    if(seen.has(title))return false;
    seen.add(title);
    return true;
  });
};
const getAssistantMoviePool=(candidates,answers,memory,{different=false}={})=>{
  const source=candidates.length?candidates:assistantFallback;
  const ranked=uniqueAssistantMovies(source)
    .map(movie=>({movie,score:scoreAssistantMovie(movie,answers,memory)}))
    .sort((a,b)=>b.score-a.score);
  const topBand=ranked.slice(0,Math.min(18,ranked.length)).map(item=>item.movie);
  const core=ranked.slice(0,8).map(item=>item.movie);
  const pool=different?selectAssistantMovies(shuffledMovies(topBand,assistantVariant),ranked.slice(18).map(item=>item.movie),{different:true}):core.slice(0,5);
  const bestScore=ranked[0]?.score||0;
  const fifthScore=ranked[4]?.score||0;
  return {pool:pool.slice(0,5),exactEnough:bestScore>18&&fifthScore>10};
};
const renderPosterWall=movies=>{
  assistantResults.innerHTML='';
  movies.forEach(movie=>assistantResults.appendChild(createAssistantCard(movie)));
};
const updateMovieWall=async ({scroll=false,different=false}={})=>{
  if(!assistantPanel||!assistantResults||!assistantReason)return;
  const requestId=++assistantRenderRequest;
  const answers=getAssistantFilters(); const memory=getAssistantMemory();
  const filterSignature=JSON.stringify(answers);
  const filtersChanged=filterSignature!==lastAssistantFilterSignature;
  if(different||filtersChanged)assistantVariant++;
  lastAssistantFilterSignature=filterSignature;
  assistantPanel.hidden=false; assistantPanel.classList.add('is-visible');
  if(!token||!assistantResults.children.length){
    const local={...getAssistantMoviePool(assistantFallback,answers,memory,{different:true}),source:assistantFallback};
    renderPosterWall(local.pool);
    assistantReason.textContent=local.exactEnough?assistantExplanation(answers,local.pool.map(normalizeMovie)):closestAssistantExplanation(answers,local.pool.map(normalizeMovie));
    console.log('Assistant filters changed:', answers);
    console.log('New movie results:', local.pool);
  }else{
    assistantReason.textContent='Finding a fresh set of movie posters from the live catalogue…';
  }
  try{
    let candidates;
    try{candidates=await fetchAssistantMovies(answers);}catch{candidates=assistantFallback;}
    if(requestId!==assistantRenderRequest)return;
    const fallbackForCurrentFilters=assistantFallback;
    if(!candidates.length)candidates=fallbackForCurrentFilters;
    if(candidates.length<5){
      const seen=new Set(candidates.map(movie=>normalizeMovie(movie).title));
      candidates=[...candidates,...fallbackForCurrentFilters.filter(movie=>!seen.has(movie.title))];
    }
    const candidateTitles=new Set(candidates.map(movie=>normalizeMovie(movie).title));
    candidates=[...candidates,...fallbackForCurrentFilters.filter(movie=>!candidateTitles.has(movie.title))];
    const {pool,exactEnough}=getAssistantMoviePool(candidates,answers,memory,{different});
    renderPosterWall(pool);
    assistantReason.textContent=pool.length?(exactEnough?assistantExplanation(answers,pool.map(normalizeMovie)):closestAssistantExplanation(answers,pool.map(normalizeMovie))):`No strong ${answers.platform} matches found for these filters. Try another genre, age, or platform.`;
  }catch(error){
    if(requestId!==assistantRenderRequest)return;
    const fallbackForCurrentFilters=assistantFallback;
    const pool=selectAssistantMovies([],fallbackForCurrentFilters,{different:true});
    console.log('Assistant filters changed:', answers);
    console.log('New movie results:', pool);
    renderPosterWall(pool);
    assistantReason.textContent=pool.length?closestAssistantExplanation(answers,pool.map(normalizeMovie)):`No strong ${answers.platform} matches found for these filters. Try another genre, age, or platform.`;
  }
  if(scroll)assistantPanel.scrollIntoView({behavior:'smooth',block:'start'});
};
const renderAssistantRecommendations=updateMovieWall;
assistantForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  updateMovieWall({scroll:true,different:true});
});
assistantForm?.addEventListener('change',event=>{
  if(!event.target.matches('select,input,[data-assistant-filter]')||!assistantPanel)return;
  assistantReason.textContent='Filters changed. Press “Find my movie” to update the poster wall.';
});
assistantForm?.addEventListener('input',event=>{
  if(!event.target.matches('select,input,[data-assistant-filter]')||!assistantPanel)return;
  assistantReason.textContent='Filters changed. Press “Find my movie” to update the poster wall.';
});
assistantRefreshButton?.addEventListener('click',()=>updateMovieWall({different:true,scroll:false}));
document.querySelector('[data-clear-decision-memory]')?.addEventListener('click',()=>{try{localStorage.removeItem(assistantStorageKey);}catch{}updateAssistantMemory();});
assistantLibrarySearch?.addEventListener('input',updateAssistantMemory);
updateAssistantMemory();

const communityForm=document.querySelector('[data-community-form]');
const communityMovieInput=communityForm?.querySelector('[data-community-movie-search]');
const communityMovieSuggestions=communityForm?.querySelector('[data-community-movie-suggestions]');
const communityPosterPreview=communityForm?.querySelector('[data-community-poster-preview]');
const communityTmdbIdInput=communityForm?.querySelector('[data-community-tmdb-id]');
const communityReleaseYearInput=communityForm?.querySelector('[data-community-release-year]');
const communityPosterPathInput=communityForm?.querySelector('[data-community-poster-path]');
const communityPosterUrlInput=communityForm?.querySelector('[data-community-poster-url]');
const memoryWall=document.querySelector('.memory-wall');
const communityArchive=document.querySelector('.community-archive');
const communityDialog=document.querySelector('[data-community-dialog]');
const communityDialogContent=document.querySelector('[data-community-dialog-content]');
const communityCurrent=document.querySelector('[data-community-current]');
const communityTotal=document.querySelector('[data-community-total]');
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const communityStorageKey='cinemaCommunityMemories';
const communityTestCleanupKey='cinemaLatestTestReviewRemoved';
const communityGraceMs=60000;
let communityGraceTimer;
const formatCommunityDate=value=>{
  const date=value?new Date(value):new Date();
  if(Number.isNaN(date.getTime()))return value||'Today';
  return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
};
const communityReviewId=memory=>memory.id||`${memory.recordedAt||''}|${memory.movie||''}|${memory.name||''}|${memory['review-title']||''}`;
const formatGraceTime=milliseconds=>{
  const totalSeconds=Math.max(0,Math.ceil(milliseconds/1000));
  return `${String(Math.floor(totalSeconds/60)).padStart(2,'0')}:${String(totalSeconds%60).padStart(2,'0')}`;
};
const savedCommunityMemories=()=>{
  try{return JSON.parse(localStorage.getItem(communityStorageKey)||'[]');}catch{return [];}
};
const persistCommunityMemories=memories=>localStorage.setItem(communityStorageKey,JSON.stringify(memories));
const normalizeCommunityTitle=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const communityPosterFallback=title=>posterFallback(title||'Community Review');
const communityPosterFromPath=(posterPath,title)=>posterPath?`${imageBase}${posterPath}`:communityPosterFallback(title);
const isCommunityPlaceholderPoster=poster=>{
  const value=String(poster||'');
  return !value||value.startsWith('data:image/svg+xml')||value.includes('movie-poster-fallback.svg')||/\/images\/journal-[^/]+\.svg/.test(value);
};
const fetchCommunityMovieMatch=async title=>{
  if(!token||!title)return null;
  try{
    const data=await tmdb('/search/movie',{query:title,include_adult:'false',page:'1'});
    const results=Array.isArray(data.results)?data.results:[];
    const normalizedTitle=normalizeCommunityTitle(title);
    const match=results.find(movie=>movie.poster_path&&normalizeCommunityTitle(movie.title)===normalizedTitle)||results.find(movie=>movie.poster_path);
    return match?normalizeCommunityMovieResult(match):null;
  }catch{
    return null;
  }
};
const fetchCommunityPoster=async title=>{
  const match=await fetchCommunityMovieMatch(title);
  return match?.posterUrl||communityPosterFallback(title);
};
let communityMovieSearchTimer;
let communityMovieSearchController;
let selectedCommunityMovie=null;
const clearCommunityMovieSelection=()=>{
  selectedCommunityMovie=null;
  if(communityTmdbIdInput)communityTmdbIdInput.value='';
  if(communityReleaseYearInput)communityReleaseYearInput.value='';
  if(communityPosterPathInput)communityPosterPathInput.value='';
  if(communityPosterUrlInput)communityPosterUrlInput.value='';
  if(communityPosterPreview){
    communityPosterPreview.hidden=true;
    communityPosterPreview.querySelector('img')?.removeAttribute('src');
    const label=communityPosterPreview.querySelector('span');
    if(label)label.textContent='';
  }
};
const hideCommunityMovieSuggestions=()=>{
  if(communityMovieSuggestions){
    communityMovieSuggestions.hidden=true;
    communityMovieSuggestions.replaceChildren();
  }
  communityMovieInput?.setAttribute('aria-expanded','false');
};
const showCommunityPosterPreview=movie=>{
  if(!communityPosterPreview||!movie)return;
  const poster=movie.posterUrl||communityPosterFallback(movie.title);
  const image=communityPosterPreview.querySelector('img');
  const label=communityPosterPreview.querySelector('span');
  if(image){
    image.src=poster;
    image.alt=`Poster for ${movie.title}`;
    image.onerror=()=>{image.onerror=null;image.src=communityPosterFallback(movie.title);};
  }
  if(label)label.textContent=`${movie.title}${movie.releaseYear?` (${movie.releaseYear})`:''}`;
  communityPosterPreview.hidden=false;
};
const storeCommunityMovieSelection=movie=>{
  selectedCommunityMovie=movie;
  if(communityMovieInput)communityMovieInput.value=movie.displayTitle;
  if(communityTmdbIdInput)communityTmdbIdInput.value=movie.tmdbId;
  if(communityReleaseYearInput)communityReleaseYearInput.value=movie.releaseYear;
  if(communityPosterPathInput)communityPosterPathInput.value=movie.posterPath;
  if(communityPosterUrlInput)communityPosterUrlInput.value=movie.posterUrl;
  showCommunityPosterPreview(movie);
  hideCommunityMovieSuggestions();
};
const normalizeCommunityMovieResult=movie=>{
  const releaseYear=(movie.release_date||'').slice(0,4);
  const title=movie.title||movie.name||'Untitled film';
  const posterPath=movie.poster_path||'';
  return {
    tmdbId:movie.id?String(movie.id):'',
    title,
    displayTitle:`${title}${releaseYear?` (${releaseYear})`:''}`,
    releaseYear,
    posterPath,
    posterUrl:communityPosterFromPath(posterPath,title)
  };
};
const renderCommunityMovieSuggestions=movies=>{
  if(!communityMovieSuggestions||!communityMovieInput)return;
  communityMovieSuggestions.replaceChildren();
  if(!movies.length){
    communityMovieSuggestions.hidden=true;
    communityMovieInput.setAttribute('aria-expanded','false');
    return;
  }
  movies.forEach(movie=>{
    const option=document.createElement('button');
    option.type='button';
    option.className='movie-suggestion';
    option.setAttribute('role','option');
    option.dataset.tmdbId=movie.tmdbId;
    const image=document.createElement('img');
    image.src=movie.posterUrl;
    image.alt='';
    image.loading='lazy';
    image.onerror=()=>{image.onerror=null;image.src=communityPosterFallback(movie.title);};
    const text=document.createElement('span');
    const title=document.createElement('strong');
    title.textContent=movie.title;
    const year=document.createElement('small');
    year.textContent=movie.releaseYear||'Release year unavailable';
    text.append(title,year);
    option.append(image,text);
    option.addEventListener('click',()=>storeCommunityMovieSelection(movie));
    communityMovieSuggestions.append(option);
  });
  communityMovieSuggestions.hidden=false;
  communityMovieInput.setAttribute('aria-expanded','true');
};
const searchCommunityMovies=query=>{
  clearTimeout(communityMovieSearchTimer);
  communityMovieSearchTimer=setTimeout(async()=>{
    if(!token||query.length<2){hideCommunityMovieSuggestions();return;}
    communityMovieSearchController?.abort();
    communityMovieSearchController=new AbortController();
    try{
      const url=new URL(`${apiBase}/search/movie`);
      url.searchParams.set('query',query);
      url.searchParams.set('include_adult','false');
      url.searchParams.set('page','1');
      const response=await fetch(url,{signal:communityMovieSearchController.signal,headers:{Authorization:`Bearer ${token}`,accept:'application/json'}});
      if(!response.ok)throw new Error('Movie search failed');
      const data=await response.json();
      const movies=(Array.isArray(data.results)?data.results:[]).slice(0,6).map(normalizeCommunityMovieResult);
      renderCommunityMovieSuggestions(movies);
    }catch(error){
      if(error.name!=='AbortError')hideCommunityMovieSuggestions();
    }
  },120);
};
const openCommunityReview=card=>{
  if(!communityDialog||!communityDialogContent||!card)return;
  const data=card.dataset;
  const score=Math.max(0,Math.min(5,parseInt(data.rating,10)||0));
  const fallbackPoster=escapeHTML(communityPosterFallback(data.movie));
  const poster=escapeHTML(data.poster||communityPosterFallback(data.movie));
  communityDialogContent.innerHTML=`
    <div class="community-dialog-grid">
      <img src="${poster}" alt="Poster for ${escapeHTML(data.movie||'community review')}" onerror="this.onerror=null;this.src='${fallbackPoster}';">
      <div>
        <span class="memory-rating">${'★'.repeat(score)}${'☆'.repeat(5-score)}</span>
        <h3>${escapeHTML(data.movie||'Untitled film')}</h3>
        <h4>${escapeHTML(data.reviewTitle||'Community review')}</h4>
        <p>${escapeHTML(data.experience||'A cinema memory worth keeping.')}</p>
        <dl>
          <div><dt>Author</dt><dd>${escapeHTML(data.author||'Anonymous')}</dd></div>
          <div><dt>Date</dt><dd>${escapeHTML(formatCommunityDate(data.date))}</dd></div>
          <div><dt>Cinema</dt><dd>${escapeHTML(data.cinema||'Cinema memory')}</dd></div>
          <div><dt>Recommend</dt><dd>${escapeHTML(data.recommend||'Maybe')}</dd></div>
          <div><dt>Before</dt><dd>${escapeHTML(data.before||'-')}</dd></div>
          <div><dt>After</dt><dd>${escapeHTML(data.after||'-')}</dd></div>
        </dl>
      </div>
    </div>`;
  if(typeof communityDialog.showModal==='function')communityDialog.showModal();
};
const addMemoryCard=memory=>{
  if(!memoryWall||!memory.movie)return;
  const score=Math.max(0,Math.min(5,parseInt(memory.rating,10)||0));
  const recordedAt=memory.recordedAt||new Date().toISOString();
  const poster=memory.posterUrl||memory.poster||communityPosterFromPath(memory.posterPath,memory.movie);
  const isLocal=!!memory.isLocal;
  const reviewId=communityReviewId(memory);
  const card=document.createElement('article');card.className='memory-case is-visible';card.tabIndex=0;card.setAttribute('aria-label',`Open ${memory.name||'Anonymous'}'s review of ${memory.movie}`);
  card.dataset.reviewId=reviewId;card.dataset.localReview=isLocal?'true':'false';card.dataset.movie=memory.movie;card.dataset.tmdbId=memory.tmdbId||'';card.dataset.releaseYear=memory.releaseYear||'';card.dataset.posterPath=memory.posterPath||'';card.dataset.reviewTitle=memory['review-title']||'Community review';card.dataset.rating=String(score);card.dataset.author=memory.name||'Anonymous';card.dataset.date=recordedAt;card.dataset.cinema=memory.cinema||'Cinema memory';card.dataset.poster=poster;card.dataset.experience=memory.experience||'A cinema memory worth keeping.';card.dataset.preview=memory.preview||memory.experience||'A cinema memory worth keeping.';card.dataset.before=memory['feeling-before']||'-';card.dataset.after=memory['feeling-after']||'-';card.dataset.recommend=memory.recommend||'Maybe';
  const image=document.createElement('img');image.src=poster;image.alt=`Poster thumbnail for ${memory.movie}`;image.loading='eager';image.decoding='async';image.onerror=()=>{image.onerror=null;image.src=communityPosterFallback(memory.movie);card.dataset.poster=image.src;};
  const spine=document.createElement('span');spine.className='case-spine';
  const rating=document.createElement('span');rating.className='memory-rating';rating.textContent='★'.repeat(score)+'☆'.repeat(5-score);
  const title=document.createElement('strong');title.textContent=memory.movie;
  const reviewTitle=document.createElement('em');reviewTitle.textContent=memory['review-title']||'Community review';
  const preview=document.createElement('p');preview.textContent=memory.preview||memory.experience||'A cinema memory worth keeping.';
  const byline=document.createElement('small');byline.textContent=`${memory.name||'Anonymous'} · ${formatCommunityDate(recordedAt)}`;
  spine.append(rating,title,reviewTitle,preview,byline);
  if(isLocal){
    const controls=document.createElement('div');controls.className='grace-controls';controls.hidden=true;
    const countdown=document.createElement('span');countdown.className='grace-countdown';countdown.setAttribute('aria-live','polite');
    const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.className='grace-delete';deleteButton.dataset.deleteReview=reviewId;deleteButton.textContent='Delete';
    controls.append(countdown,deleteButton);card.append(controls);
  }
  card.append(image,spine);memoryWall.append(card);communityCards=[...memoryWall.querySelectorAll('.memory-case')];updateCommunityDeck(communityCards.length-1);updateGraceControls();
};
const applyCommunityPosterToCard=(reviewId,memory)=>{
  const card=[...(memoryWall?.querySelectorAll('.memory-case')||[])].find(item=>item.dataset.reviewId===reviewId);
  if(!card)return;
  const poster=memory.posterUrl||memory.poster||communityPosterFromPath(memory.posterPath,memory.movie);
  card.dataset.movie=memory.movie||card.dataset.movie;
  card.dataset.tmdbId=memory.tmdbId||card.dataset.tmdbId||'';
  card.dataset.releaseYear=memory.releaseYear||card.dataset.releaseYear||'';
  card.dataset.posterPath=memory.posterPath||card.dataset.posterPath||'';
  card.dataset.poster=poster;
  const image=card.querySelector('img');
  if(image){
    image.src=poster;
    image.alt=`Poster thumbnail for ${memory.movie||card.dataset.movie||'community review'}`;
  }
};
const upgradeSavedCommunityPosters=async()=>{
  if(!token||!memoryWall)return;
  const memories=savedCommunityMemories();
  let changed=false;
  for(const memory of memories){
    if(memory.posterLookupFailed||!memory.movie||!isCommunityPlaceholderPoster(memory.posterUrl||memory.poster))continue;
    const match=await fetchCommunityMovieMatch(memory.movie);
    if(match?.posterPath){
      memory.movie=match.title;
      memory.tmdbId=match.tmdbId;
      memory.releaseYear=match.releaseYear;
      memory.posterPath=match.posterPath;
      memory.posterUrl=match.posterUrl;
      memory.poster=match.posterUrl;
      applyCommunityPosterToCard(communityReviewId(memory),memory);
      changed=true;
    }else{
      memory.posterLookupFailed=true;
      changed=true;
    }
  }
  if(changed)persistCommunityMemories(memories);
};
let communityActiveIndex=0;
let communityCards=memoryWall?[...memoryWall.querySelectorAll('.memory-case')]:[];
let communityWheelDelta=0;
let communityAnimating=false;
let communityWheelTimer;
const communityWheelThreshold=4;
const communityAnimationMs=145;
const updateCommunityDeck=index=>{
  if(!memoryWall)return;
  if(!communityCards.length)communityCards=[...memoryWall.querySelectorAll('.memory-case')];
  if(!communityCards.length)return;
  communityActiveIndex=Math.max(0,Math.min(communityCards.length-1,index));
  memoryWall.dataset.activeIndex=String(communityActiveIndex);
  if(communityCurrent)communityCurrent.textContent=String(communityActiveIndex+1).padStart(2,'0');
  if(communityTotal)communityTotal.textContent=String(communityCards.length).padStart(2,'0');
  communityCards.forEach((card,cardIndex)=>{
    const offset=cardIndex-communityActiveIndex;
    card.dataset.index=String(cardIndex);
    card.dataset.state=offset===0?'active':offset===-1?'prev':offset===1?'next':offset<-1?'past':'future';
    card.dataset.visible=Math.abs(offset)<=1?'true':'false';
    card.tabIndex=Math.abs(offset)<=1?0:-1;
  });
};
const moveCommunityDeck=direction=>{
  if(!memoryWall||!communityCards.length)return false;
  const nextIndex=communityActiveIndex+direction;
  if(nextIndex<0||nextIndex>=communityCards.length)return false;
  updateCommunityDeck(nextIndex);
  return true;
};
const flushCommunityWheel=()=>{
  if(communityAnimating||Math.abs(communityWheelDelta)<communityWheelThreshold)return;
  const direction=communityWheelDelta>0?1:-1;
  communityWheelDelta=0;
  if(!moveCommunityDeck(direction))return;
  communityAnimating=true;
  clearTimeout(communityWheelTimer);
  communityWheelTimer=setTimeout(()=>{
    communityAnimating=false;
  },communityAnimationMs);
};
communityArchive?.addEventListener('wheel',event=>{
  const unit=event.deltaMode===1?16:event.deltaMode===2?120:1;
  const delta=event.deltaY*unit;
  const direction=Math.sign(delta);
  if(!direction)return;
  const canMove=direction>0?communityActiveIndex<communityCards.length-1:communityActiveIndex>0;
  if(!canMove)return;
  event.preventDefault();
  if(communityAnimating)return;
  if(Math.sign(communityWheelDelta)&&Math.sign(communityWheelDelta)!==direction)communityWheelDelta=0;
  communityWheelDelta+=delta;
  communityWheelDelta=Math.max(-communityWheelThreshold,Math.min(communityWheelThreshold,communityWheelDelta));
  flushCommunityWheel();
},{passive:false});
memoryWall?.addEventListener('click',event=>{
  const deleteButton=event.target.closest('[data-delete-review]');
  if(deleteButton){
    event.preventDefault();
    event.stopPropagation();
    const reviewId=deleteButton.dataset.deleteReview;
    const card=deleteButton.closest('.memory-case');
    persistCommunityMemories(savedCommunityMemories().filter(memory=>communityReviewId(memory)!==reviewId));
    const deletedIndex=communityCards.indexOf(card);
    card?.remove();
    communityCards=memoryWall?[...memoryWall.querySelectorAll('.memory-case')]:[];
    updateCommunityDeck(Math.min(deletedIndex>-1?deletedIndex:communityActiveIndex,Math.max(0,communityCards.length-1)));
    updateGraceControls();
    return;
  }
  const card=event.target.closest('.memory-case');
  if(!card||!memoryWall.contains(card))return;
  const index=parseInt(card.dataset.index,10);
  if(index!==communityActiveIndex){updateCommunityDeck(index);return;}
  openCommunityReview(card);
});
memoryWall?.addEventListener('keydown',event=>{
  const keyMap={ArrowDown:1,ArrowRight:1,PageDown:1,ArrowUp:-1,ArrowLeft:-1,PageUp:-1};
  if(keyMap[event.key]){
    const nextIndex=Math.max(0,Math.min(communityCards.length-1,communityActiveIndex+keyMap[event.key]));
    if(nextIndex!==communityActiveIndex){event.preventDefault();updateCommunityDeck(nextIndex);}
    return;
  }
  if((event.key==='Enter'||event.key===' ')&&event.target.closest('.memory-case')){
    event.preventDefault();
    const card=event.target.closest('.memory-case');
    const index=parseInt(card.dataset.index,10);
    if(index===communityActiveIndex)openCommunityReview(card);else updateCommunityDeck(index);
  }
});
communityDialog?.addEventListener('click',event=>{if(event.target===communityDialog)communityDialog.close();});
communityMovieInput?.addEventListener('input',()=>{
  const query=communityMovieInput.value.trim();
  if(selectedCommunityMovie&&query!==selectedCommunityMovie.displayTitle&&query!==selectedCommunityMovie.title)clearCommunityMovieSelection();
  searchCommunityMovies(query);
});
communityMovieInput?.addEventListener('focus',()=>{
  const query=communityMovieInput.value.trim();
  if(query.length>=2&&!selectedCommunityMovie)searchCommunityMovies(query);
});
communityMovieInput?.addEventListener('keydown',event=>{
  if(event.key==='Escape')hideCommunityMovieSuggestions();
  if(event.key==='Enter'&&communityMovieSuggestions&&!communityMovieSuggestions.hidden){
    const firstSuggestion=communityMovieSuggestions.querySelector('.movie-suggestion');
    if(firstSuggestion){
      event.preventDefault();
      firstSuggestion.click();
    }
  }
});
document.addEventListener('click',event=>{
  if(!communityForm?.contains(event.target))hideCommunityMovieSuggestions();
});
const updateGraceControls=()=>{
  if(!memoryWall)return;
  memoryWall.querySelectorAll('.memory-case[data-local-review="true"]').forEach(card=>{
    const controls=card.querySelector('.grace-controls');
    if(!controls)return;
    const remaining=communityGraceMs-(Date.now()-new Date(card.dataset.date).getTime());
    if(remaining<=0){
      controls.hidden=true;
      return;
    }
    controls.hidden=false;
    const countdown=controls.querySelector('.grace-countdown');
    if(countdown)countdown.textContent=`You can delete this review for ${formatGraceTime(remaining)}`;
  });
  const hasActiveGrace=[...memoryWall.querySelectorAll('.memory-case[data-local-review="true"]')].some(card=>{
    const remaining=communityGraceMs-(Date.now()-new Date(card.dataset.date).getTime());
    return remaining>0;
  });
  if(hasActiveGrace&&!communityGraceTimer)communityGraceTimer=setInterval(updateGraceControls,1000);
  if(!hasActiveGrace&&communityGraceTimer){clearInterval(communityGraceTimer);communityGraceTimer=null;}
};
if(!localStorage.getItem(communityTestCleanupKey)){
  const memories=savedCommunityMemories();
  if(memories.length){
    memories.sort((a,b)=>new Date(a.recordedAt||0)-new Date(b.recordedAt||0));
    memories.pop();
    persistCommunityMemories(memories);
  }
  localStorage.setItem(communityTestCleanupKey,'true');
}
savedCommunityMemories().forEach(memory=>addMemoryCard({...memory,isLocal:true}));
communityCards=memoryWall?[...memoryWall.querySelectorAll('.memory-case')]:[];
updateCommunityDeck(0);
updateGraceControls();
upgradeSavedCommunityPosters();
communityForm?.addEventListener('submit',async event=>{
  event.preventDefault(); const message=communityForm.querySelector('[data-community-message]'); message.textContent='Saving your cinema memory…';
  const formData=new FormData(communityForm);
  const memory=Object.fromEntries(formData.entries());
  if(selectedCommunityMovie&&(communityMovieInput.value.trim()===selectedCommunityMovie.displayTitle||communityMovieInput.value.trim()===selectedCommunityMovie.title)){
    memory.movie=selectedCommunityMovie.title;
    memory.tmdbId=selectedCommunityMovie.tmdbId;
    memory.releaseYear=selectedCommunityMovie.releaseYear;
    memory.posterPath=selectedCommunityMovie.posterPath;
    memory.poster=selectedCommunityMovie.posterUrl;
    memory.posterUrl=selectedCommunityMovie.posterUrl;
    formData.set('movie',memory.movie);
    formData.set('tmdbId',memory.tmdbId);
    formData.set('releaseYear',memory.releaseYear);
    formData.set('posterPath',memory.posterPath);
    formData.set('poster',memory.poster);
  }
  memory.poster=String(memory.poster||'').trim();
  memory.posterPath=String(memory.posterPath||'').trim();
  memory.posterUrl=String(memory.posterUrl||memory.poster||'').trim();
  if(!memory.posterUrl&&memory.posterPath){
    memory.posterUrl=communityPosterFromPath(memory.posterPath,memory.movie);
    memory.poster=memory.posterUrl;
    formData.set('poster',memory.posterUrl);
  }
  if(!memory.posterUrl){
    message.textContent='Finding a poster for your review…';
    const matchedMovie=await fetchCommunityMovieMatch(memory.movie);
    if(matchedMovie){
      memory.movie=matchedMovie.title;
      memory.tmdbId=matchedMovie.tmdbId;
      memory.releaseYear=matchedMovie.releaseYear;
      memory.posterPath=matchedMovie.posterPath;
      memory.posterUrl=matchedMovie.posterUrl;
      formData.set('movie',memory.movie);
      formData.set('tmdbId',memory.tmdbId);
      formData.set('releaseYear',memory.releaseYear);
      formData.set('posterPath',memory.posterPath);
    }else{
      memory.posterUrl=communityPosterFallback(memory.movie);
    }
    memory.poster=memory.posterUrl;
    formData.set('poster',memory.posterUrl);
  }
  if(!memory.posterUrl){memory.posterUrl=communityPosterFallback(memory.movie);memory.poster=memory.posterUrl;formData.set('poster',memory.posterUrl);}
  const saved=savedCommunityMemories(); const storedMemory={...memory,id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`,recordedAt:new Date().toISOString()}; saved.push(storedMemory); persistCommunityMemories(saved);
  if(!['localhost','127.0.0.1'].includes(location.hostname)){try{await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(formData).toString()});}catch{message.textContent='Saved on this device, but the online form could not be reached.';return;}}
  addMemoryCard({...storedMemory,isLocal:true}); communityForm.reset(); clearCommunityMovieSelection(); hideCommunityMovieSuggestions(); message.textContent='Your review has been added. You can delete it for 1 minute.';
});
