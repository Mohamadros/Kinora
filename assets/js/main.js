/* Framework-free interactions. Live TMDB requests are routed through the
   Kinora Supabase Edge Function so private provider credentials never enter
   the generated GitHub Pages source. */

const header = document.querySelector('[data-header]');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.primary-nav');
const navDropdown = document.querySelector('[data-nav-dropdown]');
const navDropdownToggle = document.querySelector('[data-nav-dropdown-toggle]');
const rawSupabaseUrl = document.querySelector('meta[name="supabase-url"]')?.content || '';
const rawSupabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]')?.content || '';
const normalizeSupabaseProjectUrl = value => {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!/\.supabase\.co$/i.test(parsed.hostname)) return '';
    return parsed.origin;
  } catch (_error) {
    return '';
  }
};
const supabaseUrl = normalizeSupabaseProjectUrl(rawSupabaseUrl);
const supabaseAnonKey = String(rawSupabaseAnonKey || '').trim();
const supabaseKeyLooksSecret = /service[_-]?role|secret/i.test(supabaseAnonKey);
const supabaseConfigError = (() => {
  if (!String(rawSupabaseUrl || '').trim() || !supabaseAnonKey) return 'Add Supabase URL and anon key in hugo.toml first.';
  if (!supabaseUrl) return 'Supabase URL must be the full project URL, for example https://PROJECT_ID.supabase.co. Do not include /auth/v1 or /rest/v1.';
  if (supabaseKeyLooksSecret) return 'Use the Supabase publishable anon key in the frontend, not a secret or service_role key.';
  return '';
})();
const supabaseGlobal = window.supabase || globalThis.supabase;
console.info('Kinora Supabase config', {
  supabaseUrl: supabaseUrl || String(rawSupabaseUrl || '').trim(),
  anonKeyExists: Boolean(supabaseAnonKey),
  configError: supabaseConfigError || null
});
const supabaseClient = !supabaseConfigError && supabaseGlobal ? supabaseGlobal.createClient(supabaseUrl, supabaseAnonKey) : null;
const siteRoot = document.body?.dataset.siteRoot || '/';
const tmdbAvailable=Boolean(supabaseUrl&&supabaseAnonKey);
const tmdbDebug=new URLSearchParams(window.location.search).has('debugTmdb');
const upcomingDebugEnabled=new URLSearchParams(window.location.search).has('debugUpcoming');
const kinoraStorageDebug=localStorage.getItem('kinoraDebug')==='1';
const kinoraBuildIdentifier='upcoming-debug-20260716-1505';
window.KINORA_BUILD_MARKER=kinoraBuildIdentifier;
console.info('[Kinora Build]',kinoraBuildIdentifier);
const apiBase = supabaseUrl?`${supabaseUrl}/functions/v1/tmdb-catalogue`:'';
const imageBase = 'https://image.tmdb.org/t/p/w500';
const tmdbGenreNames = { 28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime', 99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History', 27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Science Fiction', 53:'Thriller', 10752:'War', 37:'Western' };
let genreNames = {...tmdbGenreNames};
const authOpenButton=document.querySelector('[data-auth-open]');
const authUserButton=document.querySelector('[data-auth-user]');
const authLogoutButton=document.querySelector('[data-auth-logout]');
const authProfileButton=document.querySelector('[data-auth-profile]');
const accountMenu=document.querySelector('[data-account-menu]');
const accountMenuPanel=document.querySelector('[data-account-menu-panel]');
const authName=document.querySelector('[data-auth-name]');
const authInitial=document.querySelector('[data-auth-initial]');
const authDialog=document.querySelector('[data-auth-dialog]');
const authForm=document.querySelector('[data-auth-form]');
const authMessage=document.querySelector('[data-auth-message]');
const authTitle=document.querySelector('[data-auth-title]');
const authCopy=document.querySelector('[data-auth-copy]');
const authModeButtons=[...document.querySelectorAll('[data-auth-mode-button]')];
const authSignupFields=document.querySelector('[data-auth-signup-fields]');
const authPasswordField=document.querySelector('[data-auth-password-field]');
const authSubmitLabel=document.querySelector('[data-auth-submit-label]');
const authSubmitIcon=document.querySelector('[data-auth-submit-icon]');
const authSubmitButton=document.querySelector('[data-auth-submit]');
const authSwitch=document.querySelector('[data-auth-switch]');
const authForgot=document.querySelector('[data-auth-forgot]');
let kinoraSession=null;
let kinoraProfile=null;
let authUser=null;
let kinoraLibraryReady=false;
let authLoading=false;
let authStateRevision=0;
const isSupabaseReady=()=>Boolean(supabaseClient);
const currentUserId=()=>kinoraSession?.user?.id||'';
const displayAuthMessage=message=>{if(authMessage)authMessage.textContent=message;};
const authModeContent={
  login:{title:'Log in',copy:'Access your saved films, ratings, reviews, and release reminders.',submit:'Log in',switch:'New to Kinora? Create account'},
  signup:{title:'Create account',copy:'Create your Kinora profile and start building your personal cinema library.',submit:'Create account',switch:'Already have an account? Log in'},
  reset:{title:'Reset password',copy:'Enter your email and we’ll send you a secure reset link.',submit:'Send reset link',switch:'Back to log in'}
};
const setAuthMode=(mode='login')=>{
  const nextMode=mode==='signup'||mode==='reset'?mode:'login';
  authForm?.setAttribute('data-auth-mode',nextMode);
  const content=authModeContent[nextMode];
  if(authTitle)authTitle.textContent=content.title;
  if(authCopy)authCopy.textContent=content.copy;
  if(authSubmitLabel)authSubmitLabel.textContent=content.submit;
  if(authSubmitIcon)authSubmitIcon.textContent=nextMode==='signup'?'＋':'›';
  if(authSwitch)authSwitch.textContent=content.switch;
  if(authSignupFields)authSignupFields.hidden=nextMode!=='signup';
  if(authPasswordField)authPasswordField.hidden=nextMode==='reset';
  if(authForgot)authForgot.hidden=nextMode!=='login';
  authModeButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.authModeButton===nextMode));
  const usernameInput=authForm?.elements.username;
  const displayNameInput=authForm?.elements.displayName;
  const passwordInput=authForm?.elements.password;
  if(usernameInput)usernameInput.required=nextMode==='signup';
  if(displayNameInput)displayNameInput.required=false;
  if(passwordInput){passwordInput.required=nextMode!=='reset';passwordInput.autocomplete=nextMode==='signup'?'new-password':'current-password';}
  displayAuthMessage('');
};
const setAuthLoading=loading=>{
  authLoading=loading;
  if(authSubmitButton)authSubmitButton.disabled=loading;
  authModeButtons.forEach(button=>button.disabled=loading);
  if(authSwitch)authSwitch.disabled=loading;
  if(authForgot)authForgot.disabled=loading;
};
function fillCommunityReviewName(){
  const input=document.querySelector('[data-community-form] input[name="name"]');
  const field=input?.closest('[data-community-author-field]');
  if(input&&currentUserId()){
    input.value=authDisplayName();
    input.required=false;
    if(field)field.hidden=true;
  }else if(input){
    input.required=true;
    if(field)field.hidden=false;
  }
}
const openAuthDialog=(message='',mode='login')=>{
  setAuthMode(mode);
  displayAuthMessage(message||'');
  if(authDialog&&typeof authDialog.showModal==='function')authDialog.showModal();
  else alert(message||'Please log in to continue.');
};
const requireKinoraAuth=message=>{
  if(currentUserId())return true;
  openAuthDialog(message||'Log in to save this to your Kinora library.','login');
  return false;
};
const authDisplayName=()=>kinoraProfile?.display_name||kinoraProfile?.username||kinoraSession?.user?.email||'Kinora user';
const updateAuthUI=()=>{
  authUser=kinoraSession?.user||null;
  const signedIn=Boolean(currentUserId());
  if(authOpenButton)authOpenButton.hidden=signedIn;
  if(accountMenu)accountMenu.hidden=!signedIn;
  if(authUserButton)authUserButton.hidden=!signedIn;
  const name=signedIn?authDisplayName():'';
  if(authName)authName.textContent=name;
  if(authUserButton)authUserButton.title=name;
  if(authInitial)authInitial.textContent=name?name.trim().charAt(0).toUpperCase():'';
};
const readableSupabaseAuthError=error=>{
  const message=String(error?.message||error||'Supabase authentication failed.');
  if(message.includes('Invalid path specified in request URL'))return 'Supabase URL is invalid. Use https://PROJECT_ID.supabase.co in hugo.toml, without /auth/v1 or /rest/v1.';
  if(message.toLowerCase().includes('invalid api key'))return 'Supabase anon key is invalid. Use the publishable anon key, not a service role or secret key.';
  if(message.toLowerCase().includes('already registered')||message.toLowerCase().includes('already exists'))return 'This email is already registered. Please log in instead.';
  return message;
};
const fetchKinoraProfile=async ()=>{
  if(!supabaseClient||!currentUserId())return null;
  const {data,error}=await supabaseClient.from('profiles').select('*').eq('id',currentUserId()).maybeSingle();
  if(error){console.warn('Kinora profile load failed',error);return null;}
  const metadata=kinoraSession?.user?.user_metadata||{};
  kinoraProfile=data||{username:metadata.username||null,display_name:metadata.display_name||metadata.username||null};
  if(!data&&(metadata.username||metadata.display_name)){
    supabaseClient.from('profiles').upsert({id:currentUserId(),username:metadata.username||null,display_name:metadata.display_name||metadata.username||null},{onConflict:'id'}).then(({error:profileError})=>{
      if(profileError)console.warn('Kinora profile backfill failed',profileError);
    });
  }
  updateAuthUI();
  fillCommunityReviewName();
  return data;
};
const upsertKinoraProfile=async ({username='',displayName=''}={})=>{
  if(!supabaseClient||!currentUserId())return;
  const metadata=kinoraSession?.user?.user_metadata||{};
  const payload={id:currentUserId(),username:username||metadata.username||null,display_name:displayName||metadata.display_name||username||metadata.username||null};
  const {error}=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'});
  if(error)console.warn('Kinora profile save failed',error);
  await fetchKinoraProfile();
};
const setupAuth=async ()=>{
  if(!supabaseClient){
    if(supabaseConfigError)console.warn('Kinora Supabase client disabled', {supabaseUrl: supabaseUrl || String(rawSupabaseUrl || '').trim(), anonKeyExists: Boolean(supabaseAnonKey), error: supabaseConfigError});
    updateAuthUI();
    return;
  }
  const {data}=await supabaseClient.auth.getSession();
  kinoraSession=data.session;
  if(kinoraSession)await fetchKinoraProfile();
  updateAuthUI();
  supabaseClient.auth.onAuthStateChange(async (event,session)=>{
    const previousUserId=currentUserId();
    if(event==='INITIAL_SESSION'&&previousUserId===(session?.user?.id||'')){
      kinoraSession=session;
      updateAuthUI();
      return;
    }
    kinoraSession=session;
    authStateRevision++;
    kinoraLibraryReady=false;
    resetPersonalDataForAuthTransition(previousUserId,session?.user?.id||'');
    if(session)await fetchKinoraProfile();
    updateAuthUI();
    document.dispatchEvent(new CustomEvent('kinora-auth-change'));
  });
};
authOpenButton?.addEventListener('click',()=>openAuthDialog('', 'login'));
const closeAccountMenu=()=>authUserButton?.setAttribute('aria-expanded','false');
const updateAccountMenuActive=()=>{
  accountMenuPanel?.querySelectorAll('a,button').forEach(item=>item.classList.remove('is-active'));
  if(location.hash==='#my-library')accountMenuPanel?.querySelector('[data-account-link="my-library"]')?.classList.add('is-active');
};
authUserButton?.addEventListener('click',event=>{
  event.stopPropagation();
  const expanded=authUserButton.getAttribute('aria-expanded')==='true';
  authUserButton.setAttribute('aria-expanded',String(!expanded));
});
authProfileButton?.addEventListener('click',()=>{closeAccountMenu();authProfileButton.classList.add('is-active');openAuthDialog('You are logged in.','login');});
authDialog?.addEventListener('close',()=>authProfileButton?.classList.remove('is-active'));
accountMenuPanel?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeAccountMenu));
document.addEventListener('click',event=>{if(accountMenu&&!accountMenu.contains(event.target))closeAccountMenu();});
document.querySelector('[data-auth-close]')?.addEventListener('click',()=>authDialog?.close());
authModeButtons.forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.authModeButton)));
authSwitch?.addEventListener('click',()=>{
  const mode=authForm?.getAttribute('data-auth-mode');
  setAuthMode(mode==='login'?'signup':'login');
});
authForgot?.addEventListener('click',()=>setAuthMode('reset'));
authLogoutButton?.addEventListener('click',async()=>{
  if(!supabaseClient)return;
  closeAccountMenu();
  const previousUserId=currentUserId();
  await supabaseClient.auth.signOut();
  kinoraSession=null;kinoraProfile=null;kinoraLibraryReady=false;updateAuthUI();
  resetPersonalDataForAuthTransition(previousUserId,'');
});
authForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(authLoading)return;
  if(!supabaseClient){
    console.error('Kinora Supabase client unavailable', {supabaseUrl: supabaseUrl || String(rawSupabaseUrl || '').trim(), anonKeyExists: Boolean(supabaseAnonKey), error: supabaseConfigError || 'Supabase library did not load.'});
    displayAuthMessage(supabaseConfigError||'Supabase client could not start. Check the browser console.');
    return;
  }
  const mode=authForm.getAttribute('data-auth-mode');
  const action=mode==='signup'||mode==='reset'?mode:'login';
  const formData=new FormData(authForm);
  const email=String(formData.get('email')||'').trim();
  const password=String(formData.get('password')||'');
  const username=String(formData.get('username')||'').trim();
  const displayName=String(formData.get('displayName')||'').trim();
  if(action==='signup'&&!username){displayAuthMessage('Choose a username for your Kinora account.');return;}
  setAuthLoading(true);
  displayAuthMessage(action==='reset'?'Sending reset email…':(action==='signup'?'Creating your account…':'Logging in…'));
  let response;
  try{
    response=action==='reset'
      ? await supabaseClient.auth.resetPasswordForEmail(email)
      : action==='signup'
        ? await supabaseClient.auth.signUp({email,password,options:{data:{username,display_name:displayName}}})
        : await supabaseClient.auth.signInWithPassword({email,password});
  }catch(error){
    console.error('Kinora Supabase auth request failed',error);
    displayAuthMessage('Kinora account service is unavailable. Please try again.');
    setAuthLoading(false);
    return;
  }
  setAuthLoading(false);
  if(response.error){
    console.error('Kinora Supabase auth error', response.error);
    displayAuthMessage(readableSupabaseAuthError(response.error));
    return;
  }
  if(action==='reset'){
    displayAuthMessage('Password reset email sent. Check your inbox.');
    return;
  }
  if(action==='signup'&&Array.isArray(response.data.user?.identities)&&response.data.user.identities.length===0){
    setAuthMode('login');
    displayAuthMessage('This email is already registered. Please log in instead.');
    return;
  }
  kinoraSession=response.data.session||kinoraSession;
  if(kinoraSession)await upsertKinoraProfile({username,displayName});
  displayAuthMessage(action==='signup'&&!response.data.session?'Check your email to confirm your Kinora account.':'You are logged in.');
  updateAuthUI();
  fillCommunityReviewName();
  setTimeout(()=>authDialog?.close(),700);
  document.dispatchEvent(new CustomEvent('kinora-auth-change'));
});
const kinoraAuthReady=setupAuth();

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
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click',()=>{if(link!==navDropdownToggle)closeNav();}));
const closeNavDropdown=()=>navDropdownToggle?.setAttribute('aria-expanded','false');
const openNavDropdown=()=>navDropdownToggle?.setAttribute('aria-expanded','true');
const supportsHoverDropdown=()=>innerWidth>1000&&matchMedia('(hover: hover) and (pointer: fine)').matches;
navDropdownToggle?.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  const open=navDropdownToggle.getAttribute('aria-expanded')==='true';
  navDropdownToggle.setAttribute('aria-expanded',String(!open));
});
navDropdown?.addEventListener('mouseenter',()=>{if(supportsHoverDropdown())openNavDropdown();});
navDropdown?.addEventListener('pointerenter',()=>{if(supportsHoverDropdown())openNavDropdown();});
navDropdown?.addEventListener('focusin',()=>{if(supportsHoverDropdown())openNavDropdown();});
navDropdown?.addEventListener('mouseleave',()=>{if(supportsHoverDropdown())closeNavDropdown();});
navDropdown?.addEventListener('pointerleave',()=>{if(supportsHoverDropdown())closeNavDropdown();});
navDropdown?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{if(link===navDropdownToggle)return;closeNavDropdown();closeNav();}));
document.addEventListener('click',event=>{if(navDropdown&&!navDropdown.contains(event.target))closeNavDropdown();});
window.addEventListener('scroll', () => header?.classList.toggle('is-scrolled', scrollY > 40), { passive: true });
const headerScrollOffset=()=>Math.ceil((header?.getBoundingClientRect().height||78)+8);
const scrollToHashTarget=(hash,{behavior='auto',updateHistory=false}={})=>{
  if(!hash||hash==='#')return false;
  const target=document.getElementById(decodeURIComponent(hash.slice(1)));
  if(!target)return false;
  const top=Math.max(0,target.getBoundingClientRect().top+scrollY-headerScrollOffset());
  scrollTo({top,behavior});
  if(updateHistory&&location.hash!==hash)history.pushState(null,'',hash);
  return true;
};
const samePageHashFromLink=link=>{
  try{
    const url=new URL(link.href,location.href);
    return url.origin===location.origin&&url.pathname===location.pathname?url.hash:'';
  }catch{return '';}
};
document.querySelectorAll('a[href*="#"]').forEach(link=>link.addEventListener('click',event=>{
  if(link===navDropdownToggle)return;
  const hash=samePageHashFromLink(link);
  if(!hash)return;
  event.preventDefault();
  closeNavDropdown();
  closeNav();
  scrollToHashTarget(hash,{updateHistory:true});
}));
const focusMovieMatchInput=()=>{
  if(location.hash!=='#mood-finder')return;
  const input=document.querySelector('[data-decision-form] select,[data-decision-form] input,[data-decision-form] button');
  setTimeout(()=>input?.focus({preventScroll:true}),350);
};
document.querySelectorAll('a[href$="#mood-finder"]').forEach(link=>link.addEventListener('click',focusMovieMatchInput));
window.addEventListener('hashchange',focusMovieMatchInput);
focusMovieMatchInput();
window.addEventListener('hashchange',updateAccountMenuActive);
window.addEventListener('load',updateAccountMenuActive);
updateAccountMenuActive();

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
}), { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  document.querySelectorAll('.primary-nav a').forEach(link => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
}), { rootMargin: '-25% 0px -65% 0px' });
document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));

const tmdbUrl = (path, params = {}) => {
  if(!apiBase)throw new Error('TMDB proxy not configured');
  const url = new URL(apiBase);
  url.searchParams.set('path',path);
  Object.entries(params).forEach(([key, value]) => value !== '' && value !== undefined && value !== null && url.searchParams.set(key, value));
  return url;
};
const upcomingPerformance={startedAt:0,firstCardsAt:0,settledAt:0,catalogueRequests:0,detailRequests:0,creditsRequests:0,videoRequests:0,totalCandidates:0,renderCount:0,fullRenderCount:0};
const tmdbResponseCache=new Map();
const UPCOMING_CACHE_VERSION='kinora-upcoming-v5';
const resetUpcomingPerformance=()=>{
  Object.assign(upcomingPerformance,{startedAt:performance.now(),firstCardsAt:0,settledAt:0,catalogueRequests:0,detailRequests:0,creditsRequests:0,videoRequests:0,totalCandidates:0,renderCount:0,fullRenderCount:0});
};
const recordUpcomingRequest=path=>{
  if(path==='/discover/movie'||path==='/search/movie')upcomingPerformance.catalogueRequests+=1;
  else if(/^\/movie\/\d+\/credits$/.test(path))upcomingPerformance.creditsRequests+=1;
  else if(/^\/movie\/\d+\/videos$/.test(path))upcomingPerformance.videoRequests+=1;
  else if(/^\/movie\/\d+$/.test(path))upcomingPerformance.detailRequests+=1;
};
const tmdb = async (path, params = {}, externalSignal = null) => {
  if (!tmdbAvailable) throw new Error('TMDB proxy not configured');
  const url = tmdbUrl(path, params);
  const cacheKey=`${UPCOMING_CACHE_VERSION}|${url.toString()}`;
  if(typeof upcomingDebugState!=='undefined'){
    upcomingDebugState.lastRequestUrl=cacheKey;
    upcomingDebugState.lastCacheKey=cacheKey;
    upcomingDebugState.lastRequestCacheHit=tmdbResponseCache.has(cacheKey);
  }
  if(tmdbResponseCache.has(cacheKey)){
    if(typeof upcomingState!=='undefined')upcomingState.sourceMode='cache';
    return tmdbResponseCache.get(cacheKey);
  }
  recordUpcomingRequest(path);
  if(tmdbDebug)console.debug('[Upcoming TMDB] request URL',url.toString());
  const controller=new AbortController();
  const abortFromExternal=()=>controller.abort();
  if(externalSignal?.aborted)controller.abort();
  else externalSignal?.addEventListener('abort',abortFromExternal,{once:true});
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{apikey:supabaseAnonKey,accept:'application/json'}});
    const data=await response.json().catch(()=>({error:'TMDB proxy returned invalid JSON.'}));
    if(tmdbDebug){
      console.debug('[Upcoming TMDB] response status',response.status);
      console.debug('[Upcoming TMDB] response body',data);
    }
    if(!response.ok||data?.ok===false)throw new Error(data?.error||data?.message||`TMDB request failed: ${response.status}`);
    const payload=data?.data&&typeof data.data==='object'?data.data:
      data?.body&&typeof data.body==='object'?data.body:data;
    if(!payload||typeof payload!=='object')throw new Error('TMDB proxy returned an unsupported response shape.');
    tmdbResponseCache.set(cacheKey,payload);
    if(typeof upcomingState!=='undefined')upcomingState.sourceMode='live-proxy';
    return payload;
  }catch(error){
    if(tmdbDebug)console.error('[Upcoming TMDB] fetch failed',error);
    throw error;
  }finally{
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort',abortFromExternal);
  }
};
const normalizeTmdbListResponse=(payload,context='TMDB list')=>{
  if(!payload||!Array.isArray(payload.results))throw new Error(`${context} response did not contain a results array.`);
  return {
    results:payload.results,
    page:Math.max(1,Number(payload.page)||1),
    totalPages:Math.max(1,Number(payload.total_pages??payload.totalPages)||1),
    totalResults:Math.max(0,Number(payload.total_results??payload.totalResults)||payload.results.length)
  };
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

const movieGenreIds=movie=>{
  const source=movie.genre_ids||movie.genreIds||(movie.genres||[]).map(genre=>genre.id);
  return [...new Set((source||[]).map(id=>Number(id)).filter(id=>Number.isFinite(id)&&tmdbGenreNames[id]))];
};
const movieYearValue=movie=>{
  const raw=movie?.release_date||movie?.releaseDate||movie?.year||'';
  const year=Number(String(raw).slice(0,4));
  return Number.isFinite(year)&&year>0?year:0;
};
const movieDecadeCategory=year=>{
  const numeric=Number(year||0);
  if(!numeric)return 'Unknown';
  if(numeric<1980)return 'Classic';
  if(numeric<1990)return '1980s';
  if(numeric<2000)return '1990s';
  if(numeric<2010)return '2000s';
  if(numeric<2020)return '2010s';
  return '2020s';
};
const movieRuntimeCategory=runtime=>{
  const minutes=Number(runtime||0);
  if(!minutes)return 'Unknown';
  if(minutes<90)return 'Short';
  if(minutes<=140)return 'Medium';
  return 'Long';
};
const normalizeMovie = movie => ({
  id: movie.id || movie.tmdbId || null,
  tmdbId: movie.tmdbId || movie.id || null,
  title: movie.title,
  year: String(movieYearValue(movie)||'TBA'),
  releaseDate: movie.release_date || movie.releaseDate || '',
  rating: Number(movie.vote_average ?? movie.rating ?? 0).toFixed(1),
  overview: movie.overview || 'Details will be announced closer to release.',
  posterPath: movie.poster_path || movie.posterPath || '',
  poster: (movie.poster_path||movie.posterPath) ? `${imageBase}${movie.poster_path||movie.posterPath}` : (movie.posterUrl || movie.poster || posterFallback(movie.title)),
  genreIds: movieGenreIds(movie),
  genre: movie.genre || movieGenreIds(movie).slice(0, 2).map(id => genreNames[id]).filter(Boolean).join(' · '),
  runtime: Number(movie.runtime||0),
  popularity: Number(movie.popularity||0),
  voteCount: Number(movie.vote_count??movie.voteCount??0),
  voteAverage: Number(movie.vote_average??movie.voteAverage??0),
  trailerQuery: movie.trailerQuery || `${movie.title} official trailer`
});
const normalizeCategorizedMovie=rawMovie=>{
  const normalized=normalizeMovie(rawMovie||{});
  const genreIds=movieGenreIds(rawMovie||normalized);
  const genreNamesList=genreIds.map(id=>genreNames[id]||tmdbGenreNames[id]).filter(Boolean);
  const year=movieYearValue(rawMovie||normalized);
  const runtime=Number(rawMovie?.runtime||normalized.runtime||0);
  const moodTags=[...new Set(rawMovie?.moodTags||rawMovie?.moods||[])];
  const movieForMood={...normalized,...rawMovie,genreIds,genre:genreNamesList.join(' · '),runtime};
  const inferredMoods=moodTags.length?moodTags:inferAssistantMoods(movieForMood);
  const toneTags=[...new Set(rawMovie?.toneTags||inferredMoods||[])];
  return {
    ...rawMovie,
    ...normalized,
    id:rawMovie?.id||rawMovie?.tmdbId||normalized.id,
    tmdbId:rawMovie?.tmdbId||rawMovie?.id||normalized.tmdbId,
    title:normalized.title||rawMovie?.name||'',
    year:year?String(year):'TBA',
    releaseDate:normalized.releaseDate||rawMovie?.release_date||rawMovie?.releaseDate||'',
    release_date:normalized.releaseDate||rawMovie?.release_date||rawMovie?.releaseDate||'',
    runtime,
    genreIds,
    genre_names:genreNamesList,
    genreNames:genreNamesList,
    genre:genreNamesList.join(' · ')||normalized.genre||'Film',
    moodTags:inferredMoods,
    moods:inferredMoods,
    toneTags,
    decade:movieDecadeCategory(year),
    runtimeCategory:movieRuntimeCategory(runtime),
    popularity:Number(rawMovie?.popularity||normalized.popularity||0),
    voteAverage:Number(rawMovie?.vote_average??rawMovie?.voteAverage??normalized.rating??0),
    vote_average:Number(rawMovie?.vote_average??rawMovie?.voteAverage??normalized.rating??0),
    rating:Number(rawMovie?.vote_average??rawMovie?.voteAverage??normalized.rating??0).toFixed(1),
    posterPath:normalized.posterPath,
    poster_path:normalized.posterPath,
    posterUrl:normalized.poster,
    poster:normalized.poster,
    overview:normalized.overview,
    categories:{
      genres:genreNamesList,
      decade:movieDecadeCategory(year),
      runtime:movieRuntimeCategory(runtime),
      moods:inferredMoods,
      tones:toneTags
    }
  };
};

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
  if(!tmdbAvailable)throw new Error('TMDB proxy not configured');
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
  status.textContent = tmdbAvailable ? `Searching for films that fit ${config.label.toLowerCase()} emotionally…` : 'Showing curated mood selections while live discovery is unavailable.';
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
const comingEmpty = document.querySelector('[data-coming-empty]');
const radarLists = document.querySelector('[data-radar-lists]');
const genreFilter = document.querySelector('[data-genre-filter]');
const movieSearch = document.querySelector('[data-movie-search]');
const dateFilter = document.querySelector('[data-date-filter]');
const anticipatedFilter = document.querySelector('[data-anticipated-filter]');
const UPCOMING_SORT_STORAGE_KEY='kinoraUpcomingSortV1';
const UPCOMING_SORT_MODES=new Set(['','high','medium']);
if(anticipatedFilter){
  try{
    const savedSort=localStorage.getItem(UPCOMING_SORT_STORAGE_KEY)||'';
    if(UPCOMING_SORT_MODES.has(savedSort))anticipatedFilter.value=savedSort;
  }catch(error){
    if(kinoraStorageDebug)console.warn('[Upcoming] sort preference could not be restored',error);
  }
}
const loadMoreButton = document.querySelector('[data-load-more]');
const loadMoreWrap = document.querySelector('[data-load-more-wrap]');
const apiNotice = document.querySelector('[data-api-notice]');
const radarWatchlistKey='kinoraGuestUpcomingWatchlistV1';
const radarHiddenKey='kinoraGuestUpcomingHiddenV1';
const authenticatedRadarStores={watchlist:[],hidden:[]};
const reminderEmailBackendActive=true;
const reminderEmailProviderActive=true;
console.info('Email scheduler configured:', reminderEmailBackendActive);
console.info('Email provider configured:', reminderEmailProviderActive);
const radarStoreArray=key=>getRadarStore(key).map(item=>typeof item==='string'?{title:item}:item).filter(item=>item&&item.title);
const radarMovieKey=movie=>{
  const normalized=normalizeRadarMovie(movie);
  return String(normalized.id||normalized.tmdbId||`${normalized.title}-${normalized.releaseDate||normalized.year||''}`).toLowerCase();
};
const radarRecordFromMovie=(movie,extra={})=>{
  const normalized=normalizeRadarMovie(movie);
  return {
    key:radarMovieKey(normalized),
    tmdbId:normalized.id||normalized.tmdbId||null,
    title:normalized.title,
    releaseDate:normalized.releaseDate||normalized.release_date||'',
    year:normalized.year||'',
    poster:normalized.poster||posterFallback(normalized.title),
    status:extra.status||'active',
    reminderSent:Boolean(extra.reminderSent),
    ...extra
  };
};
const radarRecordMatchesMovie=(record,movie)=>{
  if(!record||!movie)return false;
  const key=radarMovieKey(movie);
  return String(record.key||'')===key||
    (record.tmdbId&&String(record.tmdbId)===String(movie.id||movie.tmdbId))||
    record.title===normalizeRadarMovie(movie).title;
};
const radarWatchlistRecords=()=>radarStoreArray(radarWatchlistKey);
const radarHiddenRecords=()=>radarStoreArray(radarHiddenKey);
const setRadarRecord=(key,record)=>{
  const records=radarStoreArray(key).filter(item=>item.key!==record.key&&item.title!==record.title);
  records.unshift(record);
  setRadarStore(key,records);
};
const removeRadarRecord=(key,recordOrTitle)=>{
  const title=typeof recordOrTitle==='string'?recordOrTitle:recordOrTitle?.title;
  const recordKey=typeof recordOrTitle==='string'?'':recordOrTitle?.key;
  setRadarStore(key,radarStoreArray(key).filter(item=>item.title!==title&&(!recordKey||item.key!==recordKey)));
};
const reconcileRadarPreferenceStores=()=>{
  const hidden=radarHiddenRecords();
  const watchlist=radarWatchlistRecords().filter(record=>!hidden.some(hiddenRecord=>
    String(hiddenRecord.tmdbId||'')&&String(hiddenRecord.tmdbId)===String(record.tmdbId||'')||
    hiddenRecord.key&&hiddenRecord.key===record.key||hiddenRecord.title===record.title
  ));
  setRadarStore(radarWatchlistKey,watchlist);
};
const upcomingState={
  sourceMode:'live',
  catalogueMovies:[],
  filteredMovies:[],
  visibleMovies:[],
  currentPage:0,
  totalPages:1,
  visibleLimit:20,
  hasMore:false,
  isLoading:false,
  loadingRevision:0,
  requestRevision:0,
  sessionRevision:0,
  abortController:null,
  usingFallback:false,
  activeFilters:{query:'',genre:'',date:'',anticipated:''},
  watchlistIds:new Set(),
  notInterestedIds:new Set(),
  reminderIds:new Set()
};
const radarInitialCount = 20;
const radarLoadMoreCount = 20;
const upcomingCandidateTarget=100;
const upcomingCandidatePageLimit=Math.ceil(upcomingCandidateTarget/20);
let upcomingLastRawCount=0;
let upcomingLastNormalizedCount=0;
let upcomingInitialLoadPromise=null;
let upcomingActivePagePromise=null;
let upcomingRefillActive=false;
let upcomingInitialRenderLogged=false;
const upcomingDebugState={refillRan:false,refillPagesFetched:0,refillFinalEligibleCount:0,lastEvent:'Waiting for Upcoming activity'};
const upcomingStructureDebug=tmdbDebug||upcomingDebugEnabled||kinoraStorageDebug;
let upcomingDebugPanel=null;
let upcomingDebugValues=null;

const activeNotInterestedIds=()=>new Set(radarHiddenRecords().map(record=>String(record.tmdbId||record.key||record.title)));
const upcomingTraceSnapshot=()=>({
  timestamp:new Date().toISOString(),
  allCount:upcomingState.catalogueMovies.length,
  filteredCount:filterRadarMovies(upcomingState.catalogueMovies).length,
  visibleCount:upcomingState.visibleMovies.length,
  currentPage:upcomingState.currentPage,
  comingLoading:upcomingState.isLoading,
  requestRevision:upcomingState.requestRevision,
  sessionRevision:authStateRevision,
  signedIn:Boolean(currentUserId())
});
const updateUpcomingDebugPanel=()=>{
  if(!upcomingDebugEnabled||!upcomingDebugValues)return;
  const filteredCount=filterRadarMovies(upcomingState.catalogueMovies).length;
  const values={
    'Build identifier':kinoraBuildIdentifier,
    'Last trace event':upcomingDebugState.lastEvent,
    'Source mode':upcomingState.sourceMode,
    'upcomingState.catalogueMovies.length':upcomingState.catalogueMovies.length,
    'upcomingState.filteredMovies.length':upcomingState.filteredMovies.length,
    'Current eligible count':filteredCount,
    'upcomingState.visibleMovies.length':upcomingState.visibleMovies.length,
    'visibleLimit':upcomingState.visibleLimit,
    'Current TMDB page':upcomingState.currentPage,
    'Total TMDB pages':upcomingState.totalPages,
    'hasMoreResults':upcomingState.hasMore,
    'Active Not Interested count':activeNotInterestedIds().size,
    'Active Watchlist count':radarWatchlistRecords().length,
    'comingLoading':upcomingState.isLoading,
    'Latest request revision':upcomingState.requestRevision,
    'Active session revision':authStateRevision,
    'Refill ran':upcomingDebugState.refillRan,
    'Pages fetched by refill':upcomingDebugState.refillPagesFetched,
    'Final eligible count after refill':upcomingDebugState.refillFinalEligibleCount,
    'Load More button exists':Boolean(loadMoreButton),
    'Load More hidden':loadMoreButton?.hidden??true,
    'Load More disabled':loadMoreButton?.disabled??true
  };
  const activeFilters=getRadarFilters();
  Object.assign(values,{
    'Active search':activeFilters.query||'none',
    'Active genre':activeFilters.genre||'all',
    'Active release range':activeFilters.date||'this month',
    'Active buzz order':activeFilters.anticipated||'release date',
    'First 10 rendered TMDB IDs':upcomingState.visibleMovies.slice(0,10).map(movie=>movie.id||movie.tmdbId).join(', ')||'none'
  });
  if(upcomingDebugState.lastRequestUrl)Object.assign(values,{
    'Last TMDB proxy request':upcomingDebugState.lastRequestUrl,
    'Last TMDB cache key':upcomingDebugState.lastCacheKey,
    'Last TMDB request cache hit':Boolean(upcomingDebugState.lastRequestCacheHit)
  });
  if(upcomingDebugState.knownMovies){
    upcomingDebugState.knownMovies.forEach(movie=>{values[`Known movie: ${movie.title}`]=movie.reason;});
  }
  if(Number.isFinite(upcomingDebugState.backgroundCandidateCount))Object.assign(values,{
    'Background candidate pages loaded':upcomingDebugState.backgroundPagesLoaded||0,
    'Background candidate count':upcomingDebugState.backgroundCandidateCount
  });
  if(upcomingDebugState.ranking)Object.assign(values,{
    'Ranking source':upcomingDebugState.ranking.activeSource,
    'Ranking sort mode':upcomingDebugState.ranking.activeSortMode,
    'Ranking movie count':upcomingDebugState.ranking.movieCount,
    'Expected first ranked TMDB ID':upcomingDebugState.ranking.expectedFirstId??'none',
    'Rendered first TMDB ID':upcomingState.visibleMovies[0]?.id??upcomingState.visibleMovies[0]?.tmdbId??'none',
    'Top 20 ranked titles':upcomingDebugState.ranking.top20.map(movie=>`${movie.rank}. ${movie.title} (${movie.finalScore.toFixed(2)})`).join(' | ')
  });
  if(upcomingPerformance.startedAt){
    Object.assign(values,{
      'Performance: time to first cards (ms)':upcomingPerformance.firstCardsAt?Math.round(upcomingPerformance.firstCardsAt-upcomingPerformance.startedAt):'pending',
      'Performance: total settle time (ms)':upcomingPerformance.settledAt?Math.round(upcomingPerformance.settledAt-upcomingPerformance.startedAt):'pending',
      'Performance: catalogue requests':upcomingPerformance.catalogueRequests,
      'Performance: detail requests':upcomingPerformance.detailRequests,
      'Performance: credits requests':upcomingPerformance.creditsRequests,
      'Performance: video requests':upcomingPerformance.videoRequests,
      'Performance: candidates received':upcomingPerformance.totalCandidates,
      'Performance: catalogue renders':upcomingPerformance.renderCount,
      'Performance: full rerenders':upcomingPerformance.fullRenderCount
    });
  }
  if(upcomingDebugState.filterCounts){
    Object.entries(upcomingDebugState.filterCounts).forEach(([label,value])=>{values[`Filter: ${label}`]=value;});
  }
  const renderedCards=[...document.querySelectorAll('#upcoming-results .upcoming-card')];
  const gridRect=comingResults?.getBoundingClientRect();
  const firstCard=renderedCards[0];
  const firstRect=firstCard?.getBoundingClientRect();
  const firstStyle=firstCard?getComputedStyle(firstCard):null;
  Object.assign(values,{
    'Rendered catalogue card nodes':renderedCards.length,
    'Catalogue grid height':Math.round(gridRect?.height||0),
    'First card width':Math.round(firstRect?.width||0),
    'First card height':Math.round(firstRect?.height||0),
    'First card display':firstStyle?.display||'missing',
    'First card visibility':firstStyle?.visibility||'missing',
    'First card opacity':firstStyle?.opacity||'missing'
  });
  upcomingDebugValues.replaceChildren(...Object.entries(values).map(([label,value])=>{
    const row=document.createElement('div');
    const term=document.createElement('dt');term.textContent=label;
    const detail=document.createElement('dd');detail.textContent=String(value);
    row.append(term,detail);
    return row;
  }));
};
const traceUpcoming=(event,details={})=>{
  if(!upcomingStructureDebug)return;
  upcomingDebugState.lastEvent=event;
  console.debug(`[Upcoming Trace] ${event}`,{...upcomingTraceSnapshot(),...details});
  updateUpcomingDebugPanel();
};

const beginUpcomingRequest=()=>{
  upcomingState.sessionRevision=authStateRevision;
  upcomingState.requestRevision+=1;
  upcomingState.abortController?.abort();
  upcomingState.abortController=new AbortController();
  return {revision:upcomingState.requestRevision,signal:upcomingState.abortController.signal};
};
const isCurrentUpcomingRequest=request=>Boolean(request)&&request.revision===upcomingState.requestRevision&&!request.signal.aborted;

const setUpcomingLoadMoreVisible=visible=>{
  if(loadMoreButton)loadMoreButton.hidden=!visible;
  if(loadMoreWrap)loadMoreWrap.hidden=!visible;
};
const logUpcomingStructure=()=>{
  if(!upcomingStructureDebug)return;
  console.debug('[Upcoming Structure] state',{
    allUpcomingCount:upcomingState.catalogueMovies.length,
    rawResultCount:upcomingLastRawCount,
    normalizedResultCount:upcomingLastNormalizedCount,
    filteredCount:upcomingState.filteredMovies.length,
    visibleCount:upcomingState.visibleMovies.length,
    renderedMainCards:document.querySelectorAll('#upcoming-results .upcoming-card').length,
    watchlistCount:radarWatchlistRecords().length,
    notInterestedCount:new Set(radarHiddenRecords().map(record=>String(record.key||record.tmdbId||record.title))).size,
    visibleLimit:upcomingState.visibleLimit,
    currentPage:upcomingState.currentPage,
    totalPages:upcomingState.totalPages,
    nextPage:Math.min(upcomingState.currentPage+1,upcomingState.totalPages),
    hasMoreResults:upcomingState.hasMore,
    filters:getRadarFilters()
  });
  console.debug('[Upcoming Structure] containers',{
    resultsExists:Boolean(document.querySelector('#upcoming-results')),
    loadMoreExists:Boolean(document.querySelector('#upcoming-load-more')),
    watchlistExists:Boolean(document.querySelector('#upcoming-watchlist')),
    notInterestedExists:Boolean(document.querySelector('#upcoming-not-interested'))
  });
};

const fillGenres = genres => {
  const existing=new Set([...genreFilter?.querySelectorAll('option')||[]].map(option=>String(option.value)));
  genres.forEach(genre => {
    if(existing.has(String(genre.id)))return;
    const option=document.createElement('option');
    option.value=genre.id;
    option.textContent=genre.name;
    genreFilter?.append(option);
    existing.add(String(genre.id));
  });
};
const authenticatedRadarStoreName=key=>key===radarHiddenKey?'hidden':'watchlist';
const getRadarStore=key=>{
  if(currentUserId())return [...authenticatedRadarStores[authenticatedRadarStoreName(key)]];
  try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}
};
const setRadarStore=(key,value)=>{
  const records=Array.isArray(value)?value:[];
  if(currentUserId())authenticatedRadarStores[authenticatedRadarStoreName(key)]=[...records];
  else try{localStorage.setItem(key,JSON.stringify(records));}catch{}
  const ids=new Set(records.map(record=>String(record.tmdbId||record.key||record.title)).filter(Boolean));
  if(key===radarHiddenKey)upcomingState.notInterestedIds=ids;
  else{
    upcomingState.watchlistIds=ids;
    upcomingState.reminderIds=new Set(ids);
  }
};
const upsertReminderPayload=async payload=>{
  const conflict=payload.tmdb_id?'user_id,tmdb_id':'user_id,movie_title,release_date';
  let response=await supabaseClient.from('upcoming_movie_reminders').upsert(payload,{onConflict:conflict});
  if(response.error&&/email/i.test(String(response.error.message||response.error))){
    const {email: _email, ...legacyPayload}=payload;
    response=await supabaseClient.from('upcoming_movie_reminders').upsert(legacyPayload,{onConflict:conflict});
  }
  return response;
};
const saveSupabaseReminder=async movie=>{
  if(!requireKinoraAuth('Log in to save this release reminder.'))return false;
  if(!supabaseClient){
    if(comingStatus)comingStatus.textContent='Reminder could not be saved online. Supabase is not configured.';
    return false;
  }
  const normalized=normalizeRadarMovie(movie);
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  const payload={
    user_id:requestedUserId,
    tmdb_id:normalized.id||normalized.tmdbId||null,
    movie_title:normalized.title,
    email:kinoraSession?.user?.email||authUser?.email||null,
    poster_url:normalized.poster||null,
    poster_path:movie.poster_path||null,
    release_date:normalized.releaseDate||normalized.release_date||null,
    reminder_status:'active',
    reminder_sent:false
  };
  console.info('Email scheduler configured:', reminderEmailBackendActive);
  console.info('Email provider configured:', reminderEmailProviderActive);
  const {error}=await upsertReminderPayload(payload);
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return false;
  if(error){
    console.warn('Release reminder save failed',error);
    if(comingStatus)comingStatus.textContent='Reminder could not be saved online. Please try again.';
    return false;
  }
  setRadarRecord(radarWatchlistKey,radarRecordFromMovie(normalized,{status:'active'}));
  console.info('Reminder saved',{tmdbId:payload.tmdb_id,title:payload.movie_title,releaseDate:payload.release_date,emailSchedulerConfigured:reminderEmailBackendActive,emailProviderConfigured:reminderEmailProviderActive});
  if(comingStatus)comingStatus.textContent=reminderEmailBackendActive&&reminderEmailProviderActive?
    'Reminder saved successfully. Email notification will be sent by the release scheduler.':
    'Reminder saved successfully. Email notifications are not configured yet.';
  return true;
};
const cancelSupabaseReminder=async record=>{
  if(!supabaseClient||!currentUserId())return false;
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  let query=supabaseClient.from('upcoming_movie_reminders').update({reminder_status:'cancelled'}).eq('user_id',requestedUserId);
  if(record.tmdbId)query=query.eq('tmdb_id',record.tmdbId);
  else query=query.eq('movie_title',record.title);
  const {error}=await query;
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return false;
  if(error){
    console.warn('Release reminder cancel failed',error);
    if(comingStatus)comingStatus.textContent='Reminder could not be cancelled online. Please try again.';
    return false;
  }
  console.info('Reminder cancelled',{tmdbId:record.tmdbId||null,title:record.title});
  return true;
};
const saveSupabaseUpcomingPreference=async (movie,preference='not_interested')=>{
  if(!supabaseClient||!currentUserId())return false;
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  const normalized=normalizeRadarMovie(movie);
  const payload={
    user_id:requestedUserId,
    tmdb_id:normalized.id||normalized.tmdbId||null,
    movie_title:normalized.title,
    release_date:normalized.releaseDate||normalized.release_date||null,
    poster_url:normalized.poster||null,
    preference
  };
  const {error}=await supabaseClient.from('upcoming_movie_preferences').upsert(payload,{onConflict:payload.tmdb_id?'user_id,tmdb_id,preference':'user_id,movie_title,release_date,preference'});
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return false;
  if(error){
    console.warn('Upcoming preference save failed',error);
    return false;
  }
  return true;
};
const deleteSupabaseUpcomingPreference=async record=>{
  if(!supabaseClient||!currentUserId())return false;
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  let query=supabaseClient.from('upcoming_movie_preferences').delete().eq('user_id',requestedUserId).eq('preference','not_interested');
  if(record.tmdbId)query=query.eq('tmdb_id',record.tmdbId);
  else query=query.eq('movie_title',record.title);
  const {error}=await query;
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return false;
  if(error){
    console.warn('Upcoming preference delete failed',error);
    return false;
  }
  return true;
};
const loadSupabaseUpcomingPreferences=async ()=>{
  if(!supabaseClient||!currentUserId())return;
  traceUpcoming('Supabase preferences start loading');
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  const {data,error}=await supabaseClient.from('upcoming_movie_preferences').select('*').eq('user_id',requestedUserId).eq('preference','not_interested');
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return;
  if(error){console.warn('Upcoming preferences load failed',error);return;}
  traceUpcoming('Supabase preferences complete',{received:(data||[]).length});
  setRadarStore(radarHiddenKey,(data||[]).map(item=>({
    key:String(item.tmdb_id||`${item.movie_title}-${item.release_date||''}`).toLowerCase(),
    tmdbId:item.tmdb_id,
    title:item.movie_title,
    releaseDate:item.release_date||'',
    poster:item.poster_url||posterFallback(item.movie_title),
    status:'not_interested'
  })).filter(item=>item.title));
  reconcileRadarPreferenceStores();
  traceUpcoming('Not Interested IDs applied');
  console.debug('[Upcoming Trace] preferences loaded', {
    allCount: upcomingState.catalogueMovies.length,
    notInterestedCount: activeNotInterestedIds().size,
    filteredCount: filterRadarMovies(upcomingState.catalogueMovies).length
  });
  renderRadarLists();
  if(upcomingState.catalogueMovies.length)await refillUpcomingAfterPreferenceChange();
};
const loadSupabaseReminders=async ()=>{
  if(!supabaseClient||!currentUserId())return;
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  const {data,error}=await supabaseClient.from('upcoming_movie_reminders').select('*').eq('user_id',requestedUserId).in('reminder_status',['active','sent']);
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return;
  if(error){console.warn('Release reminders load failed',error);return;}
  setRadarStore(radarWatchlistKey,(data||[]).map(item=>({
    key:String(item.tmdb_id||`${item.movie_title}-${item.release_date||''}`).toLowerCase(),
    tmdbId:item.tmdb_id,
    title:item.movie_title,
    releaseDate:item.release_date||'',
    poster:item.poster_url||communityPosterFromPath(item.poster_path,item.movie_title),
    status:item.reminder_status||'active',
    reminderSent:Boolean(item.reminder_sent)
  })).filter(item=>item.title));
  reconcileRadarPreferenceStores();
  renderRadarLists();
  console.info('Reminder loaded',{count:(data||[]).length,emailSchedulerConfigured:reminderEmailBackendActive,emailProviderConfigured:reminderEmailProviderActive});
};
const radarMovieByTitle=title=>upcomingState.catalogueMovies.map(normalizeRadarMovie).find(movie=>movie.title===title);
const renderRadarLists=()=>{
  if(!radarLists)return;
  const watchlist=radarWatchlistRecords();
  const hidden=radarHiddenRecords();
  radarLists.replaceChildren();
  radarLists.hidden=false;
  const makeGroup=(title,items,type)=>{
    const group=document.createElement('section');
    group.className='radar-list-group taste-memory-group';
    group.id=type==='hidden'?'upcoming-not-interested':'upcoming-watchlist';
    const heading=document.createElement('h3');
    heading.textContent=`${title} (${items.length})`;
    const list=document.createElement('ul');
    if(!items.length){
      const empty=document.createElement('li');
      empty.className='radar-list-empty';
      empty.textContent='Nothing here yet.';
      list.append(empty);
    }
    items.forEach(record=>{
      const li=document.createElement('li');
      li.className='radar-memory-item taste-memory-item';
      const poster=document.createElement('img');
      poster.className='radar-memory-poster';
      poster.src=record.poster||posterFallback(record.title);
      poster.alt=`Poster for ${record.title}`;
      poster.loading='lazy';
      poster.addEventListener('error',()=>{poster.src=posterFallback(record.title)},{once:true});
      const copy=document.createElement('span');
      copy.className='radar-memory-copy';
      const name=document.createElement('strong');
      name.className='taste-memory-title';
      name.textContent=record.title;
      const meta=document.createElement('small');
      meta.className='taste-memory-meta';
      const date=record.releaseDate||record.year||'Date TBA';
      meta.textContent=type==='hidden'?`NOT INTERESTED · ${date}`:
        record.reminderSent||record.status==='sent'?`EMAIL SENT · ${date}`:
        record.status==='cancelled'?`REMINDER CANCELLED · ${date}`:
        `REMINDER SAVED · ${date}`;
      copy.append(name,meta);
      const action=document.createElement('button');
      action.type='button';
      action.className='taste-memory-remove taste-memory-status-action';
      action.textContent=type==='hidden'?'Undo':'Remove reminder';
      action.addEventListener('click',async()=>{
        if(type==='watchlist'&&currentUserId()&&!await cancelSupabaseReminder(record))return;
        if(type==='hidden'&&currentUserId()&&!await deleteSupabaseUpcomingPreference(record))return;
        const key=type==='hidden'?radarHiddenKey:radarWatchlistKey;
        removeRadarRecord(key,record);
        renderRadarLists();
        if(type==='hidden')renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
        else patchUpcomingReminderButton(record);
      });
      li.append(poster,copy,action);
      list.append(li);
    });
    group.append(heading,list);
    return group;
  };
  radarLists.append(makeGroup('Watchlist',watchlist,'watchlist'),makeGroup('Not interested',hidden,'hidden'));
  logUpcomingStructure();
};
const UPCOMING_ANTICIPATION_OVERRIDES=new Map([
  [980431,6],   // Avatar Aang: The Last Airbender
  [969681,6],   // Spider-Man: Brand New Day
  [1003596,6],  // Avengers: Doomsday
  [1170608,6],  // Dune: Part Three
  [421892,6],   // Shrek 5
  [806704,6]    // The Batman: Part II
]);
const getAnticipationScoreBreakdown=movie=>{
  const tmdbId=Number(movie?.id??movie?.tmdbId??0);
  const popularity=Number(movie?.popularity||0);
  const voteCount=Number(movie?.vote_count??movie?.voteCount??0);
  const voteAverage=Number(movie?.vote_average??movie?.voteAverage??0);
  const releaseDate=String(movie?.release_date||movie?.releaseDate||'');
  const releaseTime=/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)?Date.parse(`${releaseDate}T00:00:00Z`):NaN;
  const daysUntilRelease=Number.isFinite(releaseTime)?Math.max(0,(releaseTime-Date.now())/86400000):3650;
  const proximityScore=Math.max(0,6-daysUntilRelease/180);
  const voteContribution=Math.log10(voteCount+1)*2;
  const ratingContribution=voteCount>0?voteAverage*.5:0;
  const curatedBoost=UPCOMING_ANTICIPATION_OVERRIDES.get(tmdbId)??0;
  const rawFinalScore=popularity+voteContribution+ratingContribution+proximityScore+curatedBoost;
  return {
    tmdbId,
    popularity,
    voteCount,
    voteAverage,
    releaseDate,
    voteContribution,
    ratingContribution,
    proximityScore,
    curatedBoost,
    finalScore:Number.isFinite(rawFinalScore)?rawFinalScore:0
  };
};
const getAnticipationScore=movie=>getAnticipationScoreBreakdown(movie).finalScore;
const getUpcomingBuzzLevel=movie=>{
  const explicit=String(movie?.buzz||'').toLowerCase();
  if(!movie?.id&&['high','medium','low'].includes(explicit))return explicit;
  const candidateScores=upcomingState.catalogueMovies
    .filter(candidate=>candidate?.id||candidate?.tmdbId)
    .map(getAnticipationScore)
    .filter(Number.isFinite)
    .sort((a,b)=>b-a);
  if(candidateScores.length<5)return'low';
  const score=getAnticipationScore(movie);
  const higherCount=candidateScores.findIndex(candidateScore=>candidateScore<=score);
  const rank=higherCount<0?candidateScores.length:higherCount;
  const percentile=rank/candidateScores.length;
  if(percentile<.2)return'high';
  if(percentile<.65)return'medium';
  return'low';
};
const normalizeRadarMovie=rawMovie=>{
  const movie=normalizeMovie(rawMovie);
  const releaseType=rawMovie.releaseType||rawMovie.release_type||'cinema';
  const platform=rawMovie.platform||rawMovie.platforms?.[0]||(releaseType==='streaming'?'Streaming':'Cinema release');
  const popularity=Number(rawMovie.popularity||0);
  const buzzLevel=getUpcomingBuzzLevel(rawMovie);
  const buzz=buzzLevel.charAt(0).toUpperCase()+buzzLevel.slice(1);
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
    popularity,
    anticipationScore:getAnticipationScore(rawMovie),
    buzzLevel
  };
};
const getRadarFilters=()=>{
  upcomingState.activeFilters={
    query:movieSearch?.value.trim().toLowerCase()||'',
    genre:genreFilter?.value||'',
    date:dateFilter?.value||'',
    anticipated:anticipatedFilter?.value||''
  };
  return {...upcomingState.activeFilters};
};
const toISODate=date=>date.toISOString().slice(0,10);
const radarDateRange=(value)=>{
  const now=new Date();
  const today=toISODate(now);
  if(value==='month')return {gte:today,lte:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,'0')}`};
  if(value==='3-months'){
    const end=new Date(now);
    end.setMonth(end.getMonth()+3);
    return {gte:today,lte:toISODate(end)};
  }
  if(value==='year')return {gte:today,lte:`${now.getFullYear()}-12-31`};
  if(value==='next-year')return {gte:`${now.getFullYear()+1}-01-01`,lte:`${now.getFullYear()+1}-12-31`};
  return {gte:today,lte:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,'0')}`};
};
const KNOWN_UPCOMING_MOVIES=[
  {id:980431,title:'Avatar Aang: The Last Airbender'},
  {id:969681,title:'Spider-Man: Brand New Day'},
  {id:1003596,title:'Avengers: Doomsday'},
  {id:1170608,title:'Dune: Part Three'},
  {id:421892,title:'Shrek 5'},
  {id:806704,title:'The Batman: Part II'},
  {id:1433568,title:'The Rope Curse 4'}
];
const filterRadarMovies=(movies,filters=getRadarFilters())=>{
  const hidden=radarHiddenRecords();
  const range=radarDateRange(filters.date);
  const normalized=movies.map(normalizeRadarMovie);
  const seenIds=new Set();
  const unique=normalized.filter(movie=>{
    const key=String(movie.id||movie.tmdbId||`${movie.title}-${movie.releaseDate}`);
    if(seenIds.has(key))return false;
    seenIds.add(key);
    return true;
  });
  const valid=unique.filter(movie=>movie.title&&(upcomingState.usingFallback||movie.id));
  const today=radarDateRange('').gte;
  const futureDated=valid.filter(movie=>/^\d{4}-\d{2}-\d{2}$/.test(movie.releaseDate||'')&&movie.releaseDate>=today);
  const dateRejected=[];
  const afterDate=futureDated.filter(movie=>{
    const releaseDate=movie.releaseDate||'';
    const matches=(!range.gte||releaseDate>=range.gte)&&(!range.lte||releaseDate<=range.lte);
    if(!matches&&dateRejected.length<20)dateRejected.push({id:movie.id,title:movie.title,releaseDate,range});
    return matches;
  });
  const afterSearch=afterDate.filter(movie=>{
    const searchable=`${movie.title} ${movie.overview} ${movie.genre} ${movie.director} ${movie.actors}`.toLowerCase();
    return !filters.query||searchable.includes(filters.query);
  });
  const afterGenre=afterSearch.filter(movie=>!filters.genre||movie.genreIds.includes(Number(filters.genre)));
  const afterWatchlist=afterGenre;
  const afterNotInterested=afterWatchlist.filter(movie=>!hidden.some(record=>radarRecordMatchesMovie(record,movie)));
  const afterReminderLogic=afterNotInterested;
  const sorted=[...afterReminderLogic].sort((a,b)=>{
    if(filters.anticipated==='high')return getAnticipationScore(b)-getAnticipationScore(a)||a.releaseDate.localeCompare(b.releaseDate);
    if(filters.anticipated==='medium'){
      const aMedium=getUpcomingBuzzLevel(a)==='medium'?0:1;
      const bMedium=getUpcomingBuzzLevel(b)==='medium'?0:1;
      return aMedium-bMedium||getAnticipationScore(b)-getAnticipationScore(a)||a.releaseDate.localeCompare(b.releaseDate);
    }
    return a.releaseDate.localeCompare(b.releaseDate);
  });
  if(upcomingStructureDebug){
    const ids=movies.map(movie=>movie.id||movie.tmdbId).filter(id=>id!==null&&id!==undefined);
    const counts={
      raw:movies.length,
      normalized:normalized.length,
      'after unique TMDB ID':unique.length,
      'unique TMDB IDs':new Set(ids.map(String)).size,
      'missing TMDB IDs':movies.length-ids.length,
      'after missing-field validation':valid.length,
      'after future-date rule':futureDated.length,
      'after selected release-date range':afterDate.length,
      'after search filter':afterSearch.length,
      'after genre filter':afterGenre.length,
      'after buzz-mode eligibility (sorting only)':afterGenre.length,
      'after buzz sort':sorted.length,
      'after watchlist exclusion (not excluded)':afterWatchlist.length,
      'after Not Interested exclusion':afterNotInterested.length,
      'after reminder logic':afterReminderLogic.length,
      'after popularity/vote threshold (none)':sorted.length,
      'final eligible':sorted.length
    };
    upcomingDebugState.filterCounts=counts;
    upcomingDebugState.knownMovies=KNOWN_UPCOMING_MOVIES.map(expected=>{
      const movie=unique.find(candidate=>String(candidate.id)===String(expected.id));
      const scoreBreakdown=movie?getAnticipationScoreBreakdown(movie):null;
      const base={...expected,endpoint:'/discover/movie',returned:Boolean(movie),releaseDate:movie?.releaseDate||'',popularity:Number(movie?.popularity||0),voteCount:Number(movie?.voteCount||0),voteAverage:Number(movie?.voteAverage||0),genreIds:movie?.genreIds||[],posterAvailable:Boolean(movie?.poster&&!String(movie.poster).startsWith('data:')),scoreBreakdown,anticipationScore:scoreBreakdown?Number(scoreBreakdown.finalScore.toFixed(2)):0,buzzLevel:movie?getUpcomingBuzzLevel(movie):'unknown',cacheSource:upcomingState.sourceMode};
      if(!movie)return {...base,reason:'not returned in the currently loaded TMDB pages for this server query'};
      if(!valid.includes(movie))return {...base,reason:'rejected: invalid TMDB ID or title'};
      if(!futureDated.includes(movie))return {...base,reason:`rejected by future-date rule (${movie.releaseDate||'missing date'})`};
      if(!afterDate.includes(movie))return {...base,reason:`rejected by release range (${movie.releaseDate||'missing date'})`};
      if(!afterSearch.includes(movie))return {...base,reason:'rejected by title search'};
      if(!afterGenre.includes(movie))return {...base,reason:'rejected by selected genre'};
      if(!afterNotInterested.includes(movie))return {...base,reason:'excluded by Not Interested preference'};
      return {...base,reason:`eligible · ${movie.releaseDate} · score ${getAnticipationScore(movie).toFixed(2)} · ${getUpcomingBuzzLevel(movie)} buzz`};
    });
    const buzzCandidates=sorted.slice(0,20).map((movie,index)=>({rank:index+1,id:movie.id,title:movie.title,...getAnticipationScoreBreakdown(movie),buzzLevel:getUpcomingBuzzLevel(movie),selectedMode:filters.anticipated||'release-date',included:true,reason:'included; buzz changes order only'}));
    upcomingDebugState.ranking={
      activeSource:upcomingState.sourceMode,
      activeSortMode:filters.anticipated||'release-date',
      movieCount:sorted.length,
      top20:buzzCandidates,
      expectedFirstId:sorted[0]?.id||null
    };
    console.debug('[Upcoming Filter Pipeline]',{filters,counts,dateRejected,buzzCandidates});
    console.table(upcomingDebugState.knownMovies);
    console.assert(afterReminderLogic.length===sorted.length,'Upcoming sorting changed the eligible movie count',{before:afterReminderLogic.length,after:sorted.length,mode:filters.anticipated});
  }
  return sorted;
};
const createRadarCard=rawMovie=>{
  const movie=normalizeRadarMovie(rawMovie);
  const watchlist=radarWatchlistRecords();
  const reminderRecord=watchlist.find(record=>radarRecordMatchesMovie(record,movie));
  const reminderActive=Boolean(reminderRecord);
  const card=document.createElement('article');
  card.className='radar-card movie-card upcoming-card';
  card.dataset.buzz=movie.buzz.toLowerCase();
  card.dataset.movieKey=radarMovieKey(movie);
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
  [
    ['Release',movie.releaseDate||'Date TBA'],
    ['Buzz',movie.buzz],
    ['Director',movie.director],
    ['Main actors',movie.actors]
  ].forEach(([term,value])=>{
    const group=document.createElement('div');
    const dt=document.createElement('dt'); dt.textContent=term;
    const dd=document.createElement('dd'); dd.textContent=value;
    group.append(dt,dd); signals.append(group);
  });
  const actions=document.createElement('div');
  actions.className='radar-actions';
  const watch=document.createElement('button');
  watch.type='button'; watch.className='watchlist-button'; watch.textContent=reminderActive?'REMINDER SAVED':'SAVE REMINDER';
  watch.addEventListener('click',async()=>{
    if(!currentUserId()){
      requireKinoraAuth('Log in to save this release reminder.');
      return;
    }
    const activeRecord=radarWatchlistRecords().find(record=>radarRecordMatchesMovie(record,movie));
    if(activeRecord){
      if(await cancelSupabaseReminder(activeRecord)){
        removeRadarRecord(radarWatchlistKey,activeRecord);
        if(comingStatus)comingStatus.textContent='Release reminder cancelled.';
        renderRadarLists();
        patchUpcomingReminderButton(movie);
      }
      return;
    }
    const hiddenRecord=radarHiddenRecords().find(record=>radarRecordMatchesMovie(record,movie));
    if(hiddenRecord){
      if(currentUserId()&&!await deleteSupabaseUpcomingPreference(hiddenRecord))return;
      removeRadarRecord(radarHiddenKey,hiddenRecord);
    }
    if(await saveSupabaseReminder(movie)){
      renderRadarLists();
      patchUpcomingReminderButton(movie);
      return;
    }
  });
  watch.classList.toggle('is-active',reminderActive);
  const trailer=document.createElement('button');
  trailer.type='button'; trailer.className='trailer-button'; trailer.innerHTML='<span aria-hidden="true">▶</span> Trailer';
  trailer.addEventListener('click',()=>openTrailer(movie));
  const hide=document.createElement('button');
  hide.type='button'; hide.className='not-interested-button'; hide.textContent='Not interested';
  hide.addEventListener('click',async()=>{
    const hiddenRecord=radarRecordFromMovie(movie,{status:'not_interested'});
    const reminderRecord=radarWatchlistRecords().find(record=>radarRecordMatchesMovie(record,movie));
    if(reminderRecord&&currentUserId()&&!await cancelSupabaseReminder(reminderRecord))return;
    if(currentUserId()&&!await saveSupabaseUpcomingPreference(movie,'not_interested')){
      if(comingStatus)comingStatus.textContent='Not Interested could not be saved online. Please try again.';
      return;
    }
    if(reminderRecord)removeRadarRecord(radarWatchlistKey,reminderRecord);
    setRadarRecord(radarHiddenKey,hiddenRecord);
    renderRadarLists();
    card.remove();
    await refillUpcomingAfterPreferenceChange();
  });
  actions.append(watch,trailer,hide);
  copy.append(meta,title,synopsis,signals,actions);
  card.append(poster,copy);
  return card;
};
const renderUpcomingResults = movies => {
  upcomingPerformance.renderCount+=1;
  upcomingPerformance.fullRenderCount+=1;
  upcomingState.filteredMovies=[...movies];
  upcomingState.visibleMovies=upcomingState.filteredMovies.slice(0,upcomingState.visibleLimit);
  const cards=upcomingState.visibleMovies.flatMap(movie=>{
    try{return [createRadarCard(movie)];}
    catch(error){console.error('[Upcoming Trace] card render failed',{movieId:movie?.id||movie?.tmdbId||null,title:movie?.title||'',error});return [];}
  });
  if(upcomingStructureDebug)console.trace('[Upcoming Trace] replacing catalogue children',{incomingCards:cards.length,selector:'#upcoming-results'});
  comingResults.replaceChildren(...cards);
  cards.forEach(card=>card.classList.add('is-visible'));
  if(cards.length&&!upcomingState.usingFallback&&!upcomingPerformance.firstCardsAt)upcomingPerformance.firstCardsAt=performance.now();
  if(comingEmpty)comingEmpty.hidden=cards.length>0;
  if(!cards.length){
    comingStatus.textContent='No movies found for this filter. Try changing your options.';
    setUpcomingLoadMoreVisible(false);
    logUpcomingStructure();
    return;
  }
  const total=upcomingState.visibleMovies.length;
  const available=upcomingState.filteredMovies.length;
  const catalogueLabel=upcomingState.usingFallback?(available===1?'curated upcoming film':'curated upcoming films'):(available===1?'future film':'future films');
  comingStatus.textContent=`Showing ${total} of ${available} ${catalogueLabel} on the radar${!upcomingState.usingFallback&&upcomingState.totalPages>upcomingState.currentPage?' — more available':''}.`;
  upcomingState.hasMore=total<available||(!upcomingState.usingFallback&&tmdbAvailable&&upcomingState.currentPage<upcomingState.totalPages);
  setUpcomingLoadMoreVisible(upcomingState.hasMore);
  const renderEvent=upcomingRefillActive?'Final render occurs':upcomingInitialRenderLogged?'Catalogue render occurs':'Initial render occurs';
  upcomingInitialRenderLogged=true;
  traceUpcoming(renderEvent);
  logUpcomingStructure();
};
function syncUpcomingViews(){
  renderRadarLists();
  if(upcomingState.catalogueMovies.length)renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
}
function patchUpcomingReminderButton(movie){
  const key=radarMovieKey(movie);
  const card=[...comingResults?.querySelectorAll('.upcoming-card')||[]].find(item=>item.dataset.movieKey===key);
  const button=card?.querySelector('.watchlist-button');
  if(!button)return;
  const active=radarWatchlistRecords().some(record=>radarRecordMatchesMovie(record,movie));
  button.textContent=active?'REMINDER SAVED':'SAVE REMINDER';
  button.classList.toggle('is-active',active);
}
const radarApiMovie=movie=>({
  ...movie,
  releaseType:'cinema',
  platform:'Cinema release',
  trailerAvailable:false
});
const mergeUpcomingCatalogue=(existing,incoming)=>{
  const merged=[];
  const seen=new Set();
  let duplicateCount=0;
  [...existing,...incoming].forEach(movie=>{
    const key=String(movie.id||movie.tmdbId||`${movie.title}-${movie.release_date||movie.releaseDate||''}`);
    if(seen.has(key)){duplicateCount+=1;return;}
    seen.add(key);
    merged.push(movie);
  });
  if(upcomingStructureDebug)console.debug('[Upcoming Deduplication]',{existing:existing.length,incoming:incoming.length,merged:merged.length,duplicateCount,missingIds:[...existing,...incoming].filter(movie=>!movie.id&&!movie.tmdbId).length});
  return merged;
};
const radarDiscoverParams=(filters=getRadarFilters(),page=1)=>{
  const range=radarDateRange(filters.date);
  const params={
    'primary_release_date.gte':range.gte,
    region:'DE',
    with_release_type:'2|3|4',
    sort_by:'popularity.desc',
    include_adult:'false',
    include_video:'false',
    language:'en-US',
    page:String(page)
  };
  if(range.lte)params['primary_release_date.lte']=range.lte;
  if(filters.genre)params.with_genres=filters.genre;
  return params;
};
const loadComingPageRequest = async (reset=false, render=true, request=beginUpcomingRequest(), background=false) => {
  if(!isCurrentUpcomingRequest(request))return false;
  if(upcomingState.isLoading&&upcomingState.loadingRevision===request.revision&&!reset)return false;
  if(reset){
    upcomingState.currentPage=0;upcomingState.totalPages=1;upcomingState.visibleLimit=radarInitialCount;
    upcomingState.catalogueMovies=[];upcomingState.filteredMovies=[];upcomingState.visibleMovies=[];
    if(comingEmpty)comingEmpty.hidden=true;
    setUpcomingLoadMoreVisible(false);
  }
  if(upcomingState.currentPage>=upcomingState.totalPages&&upcomingState.currentPage!==0)return;
  upcomingState.isLoading=true;upcomingState.loadingRevision=request.revision;
  if(!background){if(loadMoreButton)loadMoreButton.disabled=true;comingStatus.textContent='Loading future releases…';}
  const nextPage=upcomingState.currentPage+1;const filters=getRadarFilters();
  traceUpcoming(nextPage===1?'TMDB page 1 starts loading':'Additional TMDB page requested',{page:nextPage});
  try{
    let data;
    if(filters.query.length>2){
      data=normalizeTmdbListResponse(await tmdb('/search/movie',{query:filters.query,include_adult:'false',region:'DE',page:String(nextPage)},request.signal),'Upcoming search');
      const range=radarDateRange(filters.date);
      data.results=(data.results||[]).filter(movie=>{
        const releaseDate=movie.release_date||'';
        return (!releaseDate||releaseDate>=range.gte)&&(!range.lte||!releaseDate||releaseDate<=range.lte);
      });
    }else{
      data=normalizeTmdbListResponse(await tmdb('/discover/movie',radarDiscoverParams(filters,nextPage),request.signal),'Upcoming discover');
    }
    if(!isCurrentUpcomingRequest(request))return false;
    upcomingState.currentPage=data.page;upcomingState.totalPages=Math.min(data.totalPages,500);
    const rawResults=Array.isArray(data.results)?data.results:[];
    upcomingPerformance.totalCandidates+=rawResults.length;
    const batch=rawResults.map(radarApiMovie);
    upcomingLastRawCount=rawResults.length;
    upcomingLastNormalizedCount=batch.length;
    upcomingState.catalogueMovies=reset?mergeUpcomingCatalogue([],batch):mergeUpcomingCatalogue(upcomingState.catalogueMovies,batch);
    traceUpcoming(nextPage===1?'TMDB page 1 completes':'Additional TMDB page completes',{page:nextPage,received:rawResults.length});
    if(upcomingRefillActive){
      upcomingDebugState.refillPagesFetched+=1;
      console.debug('[Upcoming Trace] refill page fetched', {
        page: nextPage,
        received: rawResults.length,
        accumulated: upcomingState.catalogueMovies.length,
        eligibleCount: filterRadarMovies(upcomingState.catalogueMovies).length
      });
    }
    if(render)renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
    return true;
  }catch(error){
    if(error.name==='AbortError'||!isCurrentUpcomingRequest(request))return false;
    console.warn('Upcoming TMDB request failed',error);
    comingStatus.textContent='The live movie catalogue could not be reached.';
    return false;
  }
  finally{
    if(upcomingState.loadingRevision===request.revision){upcomingState.isLoading=false;if(!background&&loadMoreButton)loadMoreButton.disabled=false;}
    updateUpcomingDebugPanel();
  }
};
const loadComingPage=(...args)=>{
  const pending=loadComingPageRequest(...args);
  const tracked=pending.finally(()=>{
    if(upcomingActivePagePromise===tracked)upcomingActivePagePromise=null;
  });
  upcomingActivePagePromise=tracked;
  return tracked;
};
const warmUpcomingCandidateCatalogue=async request=>{
  let pagesLoaded=0;
  while(isCurrentUpcomingRequest(request)&&
    upcomingState.currentPage<upcomingState.totalPages&&
    upcomingState.currentPage<upcomingCandidatePageLimit&&
    upcomingState.catalogueMovies.length<upcomingCandidateTarget){
    const loaded=await loadComingPage(false,false,request,true);
    if(!loaded)break;
    pagesLoaded+=1;
  }
  if(!isCurrentUpcomingRequest(request))return;
  upcomingDebugState.backgroundPagesLoaded=pagesLoaded;
  upcomingDebugState.backgroundCandidateCount=upcomingState.catalogueMovies.length;
  renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
  traceUpcoming('Background candidate loading complete',{pagesLoaded,candidates:upcomingState.catalogueMovies.length});
};
const upcomingPageScanLimit=4;
const ensureUpcomingVisibleCapacity=async (request,render=true)=>{
  let filtered=filterRadarMovies(upcomingState.catalogueMovies);
  let pagesScanned=0;
  let exitReason='target reached';
  while(isCurrentUpcomingRequest(request)&&filtered.length<upcomingState.visibleLimit&&upcomingState.currentPage<upcomingState.totalPages&&pagesScanned<upcomingPageScanLimit){
    const loaded=await loadComingPage(false,false,request);
    if(!loaded){exitReason=isCurrentUpcomingRequest(request)?'fetch failed or empty page':'request became stale';break;}
    pagesScanned+=1;
    filtered=filterRadarMovies(upcomingState.catalogueMovies);
  }
  if(filtered.length>=upcomingState.visibleLimit)exitReason='target reached';
  else if(!isCurrentUpcomingRequest(request))exitReason='request became stale';
  else if(upcomingState.currentPage>=upcomingState.totalPages)exitReason='no more TMDB pages';
  else if(pagesScanned>=upcomingPageScanLimit)exitReason='safety limit reached';
  traceUpcoming('Upcoming capacity loop exited',{exitReason,pagesScanned,eligibleCount:filtered.length,visibleLimit:upcomingState.visibleLimit,currentPage:upcomingState.currentPage,totalPages:upcomingState.totalPages});
  if(render&&isCurrentUpcomingRequest(request))renderUpcomingResults(filtered);
  return filtered;
};
async function refillUpcomingAfterPreferenceChange(){
  if(upcomingInitialLoadPromise)await upcomingInitialLoadPromise;
  if(upcomingActivePagePromise)await upcomingActivePagePromise;
  const visibleLimit=upcomingState.visibleLimit;
  const currentPage=upcomingState.currentPage;
  const totalPages=upcomingState.totalPages;
  upcomingDebugState.refillRan=true;
  upcomingDebugState.refillPagesFetched=0;
  upcomingRefillActive=true;
  traceUpcoming('refillUpcomingAfterPreferenceChange starts');
  console.debug('[Upcoming Trace] refill start', {
    visibleLimit,
    currentPage,
    totalPages,
    eligibleCount: filterRadarMovies(upcomingState.catalogueMovies).length,
    comingLoading:upcomingState.isLoading
  });
  const request=beginUpcomingRequest();
  try{
    await ensureUpcomingVisibleCapacity(request,false);
    upcomingDebugState.refillFinalEligibleCount=filterRadarMovies(upcomingState.catalogueMovies).length;
    const hasMoreResults=upcomingDebugState.refillFinalEligibleCount>upcomingState.visibleLimit||(!upcomingState.usingFallback&&tmdbAvailable&&upcomingState.currentPage<upcomingState.totalPages);
    console.debug('[Upcoming Trace] refill complete', {
      finalEligibleCount: filterRadarMovies(upcomingState.catalogueMovies).length,
      currentPage:upcomingState.currentPage,
      hasMoreResults
    });
    if(isCurrentUpcomingRequest(request))renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
  }catch(error){
    console.error('[Upcoming Trace] refill failed',error);
  }finally{
    upcomingRefillActive=false;
    updateUpcomingDebugPanel();
  }
}
const activateFallbackCatalogue=()=>{
  upcomingState.usingFallback=true;
  upcomingState.sourceMode='fallback';
  if(apiNotice){
    apiNotice.hidden=false;
    const heading=apiNotice.querySelector('strong');
    const copy=apiNotice.querySelector('span');
    if(heading)heading.textContent=tmdbAvailable?'Live catalogue unavailable':'Demo catalogue active';
    if(copy)copy.textContent=tmdbAvailable?'TMDB could not be reached. Showing Kinora’s curated upcoming releases instead.':'Live movie configuration is unavailable. Showing Kinora’s curated upcoming releases instead.';
  }
  upcomingState.catalogueMovies=[...fallbackUpcoming];
  upcomingState.currentPage=1;
  upcomingState.totalPages=1;
  upcomingState.visibleLimit=radarInitialCount;
  renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
};
const loadComing = async () => {
  fillGenres(Object.entries(genreNames).map(([id,name])=>({id,name})));
  if(tmdbAvailable){
    activateFallbackCatalogue();
    resetUpcomingPerformance();
    const request=beginUpcomingRequest();
    if(apiNotice){
      const heading=apiNotice.querySelector('strong');
      const copy=apiNotice.querySelector('span');
      if(heading)heading.textContent='Loading live catalogue';
      if(copy)copy.textContent='Curated upcoming releases remain available while Kinora connects to TMDB.';
    }
    try{
      const genres=await tmdb('/genre/movie/list',{},request.signal);
      if(!isCurrentUpcomingRequest(request))return;
      genreNames=Object.fromEntries(genres.genres.map(g=>[g.id,g.name]));
      fillGenres(genres.genres);
      upcomingState.usingFallback=false;
      upcomingState.sourceMode='live';
      const firstPageLoaded=await loadComingPage(true,true,request);
      if(!firstPageLoaded||!upcomingState.catalogueMovies.length)throw new Error('TMDB returned no upcoming movies.');
      apiNotice.hidden=true;
      if(filterRadarMovies(upcomingState.catalogueMovies).length<upcomingState.visibleLimit)await ensureUpcomingVisibleCapacity(request,true);
      upcomingPerformance.settledAt=performance.now();
      if(upcomingStructureDebug)console.table({
        'Time to first cards (ms)':Math.round(upcomingPerformance.firstCardsAt-upcomingPerformance.startedAt),
        'Total settle time (ms)':Math.round(upcomingPerformance.settledAt-upcomingPerformance.startedAt),
        'Catalogue requests':upcomingPerformance.catalogueRequests,
        'Detail requests':upcomingPerformance.detailRequests,
        'Credits requests':upcomingPerformance.creditsRequests,
        'Video requests':upcomingPerformance.videoRequests,
        'Candidates received':upcomingPerformance.totalCandidates,
        'Catalogue renders':upcomingPerformance.renderCount,
        'Full catalogue rerenders':upcomingPerformance.fullRenderCount
      });
      warmUpcomingCandidateCatalogue(request).catch(error=>console.warn('Upcoming background candidate loading failed',error));
      return;
    }catch(error){
      if(error.name==='AbortError'||!isCurrentUpcomingRequest(request))return;
      console.warn('Upcoming catalogue switched to curated fallback',error);
    }
  }
  activateFallbackCatalogue();
};
const mergeRadarMovies=movies=>{
  const seen=new Set(upcomingState.catalogueMovies.map(movie=>movie.id||movie.title));
  const fresh=movies.filter(movie=>{
    const key=movie.id||movie.title;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  upcomingState.catalogueMovies=[...upcomingState.catalogueMovies,...fresh];
};
const applyRadarFilters=async ()=>{
  if(tmdbAvailable&&!upcomingState.usingFallback){
    const request=beginUpcomingRequest();
    upcomingState.visibleLimit=radarInitialCount;
    resetUpcomingPerformance();
    const firstPageLoaded=await loadComingPage(true,true,request);
    if(!firstPageLoaded){if(isCurrentUpcomingRequest(request))activateFallbackCatalogue();return;}
    if(filterRadarMovies(upcomingState.catalogueMovies).length<upcomingState.visibleLimit)await ensureUpcomingVisibleCapacity(request,true);
    upcomingPerformance.settledAt=performance.now();
    updateUpcomingDebugPanel();
    warmUpcomingCandidateCatalogue(request).catch(error=>console.warn('Upcoming background candidate loading failed',error));
    return;
  }
  upcomingState.visibleLimit=radarInitialCount;
  renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
};
const startUpcomingInitialLoad=()=>{
  if(upcomingInitialLoadPromise)return upcomingInitialLoadPromise;
  const pending=loadComing();
  const tracked=pending.finally(()=>{
    if(upcomingInitialLoadPromise===tracked)upcomingInitialLoadPromise=null;
    updateUpcomingDebugPanel();
  });
  upcomingInitialLoadPromise=tracked;
  return tracked;
};
const setupUpcomingDebugPanel=()=>{
  if(!upcomingDebugEnabled||!comingResults)return;
  upcomingDebugPanel=document.createElement('aside');
  upcomingDebugPanel.className='upcoming-debug-panel';
  upcomingDebugPanel.setAttribute('aria-label','Upcoming runtime diagnostics');
  const heading=document.createElement('h3');heading.textContent='Upcoming runtime diagnostics';
  const warning=document.createElement('p');warning.textContent='Temporary diagnostics are active because debugUpcoming=1 is present.';
  upcomingDebugValues=document.createElement('dl');
  const controls=document.createElement('div');controls.className='upcoming-debug-controls';
  const actions=[
    ['Reset Upcoming debug state',async()=>{
      beginUpcomingRequest();
      upcomingState.catalogueMovies=[];upcomingState.filteredMovies=[];upcomingState.visibleMovies=[];
      upcomingState.currentPage=0;upcomingState.totalPages=1;upcomingState.isLoading=false;upcomingState.visibleLimit=radarInitialCount;
      upcomingInitialRenderLogged=false;
      upcomingState.hasMore=false;upcomingDebugState.refillRan=false;upcomingDebugState.refillPagesFetched=0;upcomingDebugState.refillFinalEligibleCount=0;
      comingResults.replaceChildren();setUpcomingLoadMoreVisible(false);traceUpcoming('Upcoming debug state reset');
    }],
    ['Reload TMDB page 1',async()=>{await startUpcomingInitialLoad();}],
    ['Load authenticated preferences',async()=>{await loadSupabaseUpcomingPreferences();}],
    ['Run refill manually',async()=>{await refillUpcomingAfterPreferenceChange();}],
    ['Load one more TMDB page',async()=>{
      const request=beginUpcomingRequest();
      await loadComingPage(false,true,request);
    }],
    ['Render current catalogue',async()=>{renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));}]
  ];
  actions.forEach(([label,action])=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{await action();}catch(error){console.error(`[Upcoming Trace] debug control failed: ${label}`,error);}
      finally{button.disabled=false;updateUpcomingDebugPanel();}
    });
    controls.append(button);
  });
  upcomingDebugPanel.append(heading,warning,upcomingDebugValues,controls);
  document.querySelector('#upcoming-catalogue')?.before(upcomingDebugPanel);
  updateUpcomingDebugPanel();
};
genreFilter?.addEventListener('change',applyRadarFilters);
dateFilter?.addEventListener('change',applyRadarFilters);
anticipatedFilter?.addEventListener('change',()=>{
  try{localStorage.setItem(UPCOMING_SORT_STORAGE_KEY,anticipatedFilter.value);}
  catch(error){if(kinoraStorageDebug)console.warn('[Upcoming] sort preference could not be saved',error);}
  upcomingState.visibleLimit=radarInitialCount;
  renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
  updateUpcomingDebugPanel();
});
loadMoreButton?.addEventListener('click',async()=>{
  const request=beginUpcomingRequest();
  upcomingState.visibleLimit+=radarLoadMoreCount;
  await ensureUpcomingVisibleCapacity(request,true);
});
let searchTimer;
movieSearch?.addEventListener('input', () => {
  clearTimeout(searchTimer); searchTimer=setTimeout(() => {
    applyRadarFilters();
  },350);
});
const journalDataNode=document.querySelector('[data-journal-data]');
const journalSearch=document.querySelector('[data-journal-search]');
const journalFeatured=document.querySelector('[data-journal-featured]');
const journalArchive=document.querySelector('[data-journal-archive]');
const journalFilterButtons=[...document.querySelectorAll('[data-journal-filter]')];
const journalEntries=(()=>{try{return JSON.parse(journalDataNode?.textContent||'[]');}catch(error){console.warn('Kinora review data could not be read.',error);return [];}})()
  .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
const validJournalCategories=new Set(journalFilterButtons.map(button=>button.dataset.journalFilter));
const journalCategoryFromUrl=()=>{
  const value=new URL(location.href).searchParams.get('category')||'all';
  return validJournalCategories.has(value)?value:'all';
};
let journalCategory=journalCategoryFromUrl();
const journalElement=(tag,className='',text='')=>{const element=document.createElement(tag);if(className)element.className=className;if(text)element.textContent=text;return element;};
const journalEntrySearchText=entry=>[entry.title,entry.intro,entry.hook,...(entry.tags||[])].join(' ').toLowerCase();
const getEntriesForCategory=(category=journalCategory,query=(journalSearch?.value||'').trim().toLowerCase())=>journalEntries.filter(entry=>
  (category==='all'||(entry.categories||[]).includes(category))&&(!query||journalEntrySearchText(entry).includes(query))
);
const renderFeaturedReview=entry=>{
  if(!journalFeatured)return;
  const label=journalElement('p','archive-label',entry?'Featured review':'No featured review');
  if(!entry){
    const empty=journalElement('div','journal-featured-empty empty-state');
    empty.append(journalElement('h3','',journalSearch?.value.trim()?'No reviews match this search.':'No entries in this category yet.'),journalElement('p','',journalSearch?.value.trim()?'Try another title, director, or theme.':'New writing will appear here when it is published.'));
    journalFeatured.replaceChildren(label,empty);
    return;
  }
  const article=journalElement('article','journal-ticket is-visible');
  article.dataset.journalFeatured=entry.id;
  article.dataset.category=(entry.categories||[]).join(' ');
  const posterLink=journalElement('a','ticket-poster');posterLink.href=entry.url;
  const image=journalElement('img');image.src=entry.poster;image.alt=`Movie poster for ${entry.title}`;image.loading='eager';image.addEventListener('error',()=>{image.src=`${siteRoot}images/movie-poster-fallback.svg`;},{once:true});
  posterLink.append(image,journalElement('span','',String(entry.year||'')));
  const copy=journalElement('div','ticket-copy');
  const category=journalElement('p','card-label',entry.category||'Review');
  const heading=journalElement('h3');const titleLink=journalElement('a','',entry.title);titleLink.href=entry.url;heading.append(titleLink);
  const stars=journalElement('div','stars','★'.repeat(Number(entry.rating)||0)+'☆'.repeat(Math.max(0,5-(Number(entry.rating)||0))));stars.setAttribute('aria-label',`${entry.rating} out of 5 stars`);
  const intro=journalElement('p','',entry.intro||entry.hook||'');
  const details=journalElement('dl');
  [['Favorite scene',entry.favoriteScene],['Would I recommend it?',entry.recommendation]].forEach(([term,value])=>{const group=journalElement('div');group.append(journalElement('dt','',term),journalElement('dd','',value||'—'));details.append(group);});
  const tags=journalElement('div','ticket-tags');(entry.tags||[]).forEach(tag=>tags.append(journalElement('span','',tag)));
  copy.append(category,heading,stars,intro,details,tags);article.append(posterLink,copy);journalFeatured.replaceChildren(label,article);
};
const renderJournalArchive=entries=>{
  if(!journalArchive)return;
  if(!entries.length){journalArchive.replaceChildren(journalElement('p','journal-archive-empty','No additional entries in this category yet.'));return;}
  const cards=entries.map(entry=>{
    const link=journalElement('a','archive-item');link.href=entry.url;link.dataset.journalArchiveEntry=entry.id;
    const image=journalElement('img');image.src=entry.poster;image.alt=`Movie poster for ${entry.title}`;image.loading='lazy';image.addEventListener('error',()=>{image.src=`${siteRoot}images/movie-poster-fallback.svg`;},{once:true});
    const copy=journalElement('span','archive-copy');copy.append(journalElement('span','archive-title',entry.title),journalElement('span','archive-hook',entry.hook||entry.intro||''));
    const rating=journalElement('span','archive-rating','★'.repeat(Number(entry.rating)||0)+'☆'.repeat(Math.max(0,5-(Number(entry.rating)||0))));rating.setAttribute('aria-label',`${entry.rating} out of 5 stars`);copy.append(rating);
    link.append(image,copy,journalElement('span','archive-arrow','›'));return link;
  });
  journalArchive.replaceChildren(...cards);
};
const filterJournal=()=>{
  const matches=getEntriesForCategory();
  renderFeaturedReview(matches[0]||null);
  renderJournalArchive(matches.slice(1));
  journalFilterButtons.forEach(item=>{const active=item.dataset.journalFilter===journalCategory;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));});
};
const selectJournalCategory=(category,{updateHistory=true}={})=>{
  journalCategory=validJournalCategories.has(category)?category:'all';
  filterJournal();
  if(updateHistory){const url=new URL(location.href);if(journalCategory==='all')url.searchParams.delete('category');else url.searchParams.set('category',journalCategory);history.pushState({journalCategory},'',`${url.pathname}${url.search}${url.hash}`);}
};
journalFilterButtons.forEach(button=>button.addEventListener('click',()=>selectJournalCategory(button.dataset.journalFilter)));
journalSearch?.addEventListener('input',filterJournal);
window.addEventListener('popstate',()=>selectJournalCategory(journalCategoryFromUrl(),{updateHistory:false}));
if(journalDataNode)filterJournal();

const trailerDialog=document.querySelector('[data-trailer-dialog]');
const openTrailer=async movie=>{
  const content=trailerDialog.querySelector('[data-trailer-content]'); const message=trailerDialog.querySelector('[data-trailer-message]'); content.replaceChildren(); message.textContent='Finding the trailer…'; trailerDialog.showModal();
  if(movie.id&&tmdbAvailable){try{const data=await tmdb(`/movie/${movie.id}/videos`);const video=data.results.find(v=>v.site==='YouTube'&&v.type==='Trailer')||data.results.find(v=>v.site==='YouTube');if(video){const iframe=document.createElement('iframe');iframe.src=`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1`;iframe.title=`${movie.title} trailer`;iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;content.append(iframe);message.textContent='';return;}}catch{}}
  const link=document.createElement('a');link.className='button';link.href=`https://www.youtube.com/results?search_query=${encodeURIComponent(movie.trailerQuery)}`;link.target='_blank';link.rel='noopener';link.innerHTML='<span>Search trailer on YouTube</span><span aria-hidden="true">↗</span>';content.append(link);message.textContent='A direct trailer becomes available when TMDB is connected.';
};
const closeTrailer=()=>{trailerDialog.close();trailerDialog.querySelector('[data-trailer-content]').replaceChildren();};
document.querySelector('[data-trailer-close]')?.addEventListener('click',closeTrailer);
trailerDialog?.addEventListener('click',event=>{if(event.target===trailerDialog)closeTrailer();});
const closeMovieDetailToMatch=()=>{
  if(trailerDialog?.open)closeTrailer();
  requestAnimationFrame(()=>{
    const target=assistantPanel&&!assistantPanel.hidden?assistantPanel:assistantForm;
    target?.scrollIntoView({behavior:'auto',block:'start'});
    assistantResults?.querySelector('.wall-poster')?.focus({preventScroll:true});
  });
};

const assistantForm=document.querySelector('[data-decision-form]');
const assistantResults=document.querySelector('[data-assistant-results]');
const assistantPanel=document.querySelector('[data-decision-results]');
const assistantReason=document.querySelector('[data-decision-reason]');
const assistantPersonalizationNote=assistantReason?document.createElement('small'):null;
if(assistantPersonalizationNote){
  assistantPersonalizationNote.className='assistant-personalization-note';
  assistantPersonalizationNote.hidden=true;
  assistantReason.insertAdjacentElement('afterend',assistantPersonalizationNote);
}
const assistantMemory=document.querySelector('[data-decision-memory]');
const assistantLibrarySearch=document.querySelector('[data-library-search]');
const assistantRefreshButton=document.querySelector('[data-assistant-refresh]');
const assistantStorageKey='kinoraGuestMovieLibraryV1';
let authenticatedAssistantMemory;
const assistantLastVisibleKey='cinemaMovieMatchLastVisibleWallV1';
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
  'The Fabelmans':'/h7llKkqkkJtJrTOaDLuVeUYDQ7I.jpg',
  'Akira':'/neZ0ykEsPqxamsX6o5QNUFILQrz.jpg',
  'Top Gun: Maverick':'/n0YuM4f5lvGAP6MAW2kBIzugXnc.jpg'
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
const movieIdentityKey=movie=>{
  const normalized=normalizeMovie(movie||{});
  return String(movie?.tmdbId||movie?.id||`${normalized.title}-${normalized.year}`).trim().toLowerCase();
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
  {title:'Mission: Impossible - Fallout',year:'2018',runtime:147,rating:7.4,genreIds:[28,12,53],platforms:['Prime Video','Netflix'],moods:['energized','excited','inspired'],age:'modern',overview:'A high-risk mission turns precision, loyalty, and momentum into pure cinematic energy.',genre:'Action · Thriller'},
  {title:'The Fabelmans',year:'2022',runtime:151,rating:7.6,genreIds:[18],platforms:['Prime Video'],moods:['inspired','nostalgic','moved'],age:'new',overview:'A young filmmaker discovers how cinema transforms family memory, pain, and imagination.',genre:'Drama'},
  {title:'Spirited Away',year:'2001',runtime:125,rating:8.5,genreIds:[16,10751,14],platforms:['Netflix','Max','My own watchlist'],moods:['amazed','thoughtful','relaxed','curious'],age:'old',overview:'A young girl enters a spirit world where courage, kindness, and wonder help her find her way home.',genre:'Animation · Fantasy'},
  {title:'Toy Story',year:'1995',runtime:81,rating:8.3,genreIds:[16,35,10751],platforms:['Disney+','My own watchlist'],moods:['happy','entertained','relaxed','inspired'],age:'old',overview:'A group of toys turn jealousy and fear into friendship, adventure, and playful imagination.',genre:'Animation · Comedy'},
  {title:'The Iron Giant',year:'1999',runtime:86,rating:8.1,genreIds:[16,878,10751],platforms:['Prime Video','My own watchlist'],moods:['hopeful','emotional','inspired','thoughtful'],age:'old',overview:'A lonely boy befriends a giant robot and discovers a hopeful answer to fear and violence.',genre:'Animation · Sci-fi'},
  {title:'Princess Mononoke',year:'1997',runtime:134,rating:8.3,genreIds:[16,12,14],platforms:['Netflix','My own watchlist'],moods:['amazed','thoughtful','emotional'],age:'old',overview:'A prince is drawn into a mythic conflict between human industry, nature, anger, and balance.',genre:'Animation · Adventure'},
  {title:'The Lion King',year:'1994',runtime:89,rating:8.3,genreIds:[16,18,10751],platforms:['Disney+'],moods:['emotional','hopeful','inspired','entertained'],age:'old',overview:'A young lion faces grief, identity, and responsibility in a musical coming-of-age story.',genre:'Animation · Drama'},
  {title:'Akira',year:'1988',runtime:124,rating:8.0,genreIds:[16,878,28],platforms:['Prime Video','My own watchlist'],moods:['excited','amazed','thoughtful','curious'],age:'old',overview:'A cyberpunk explosion of power, mutation, and social unrest in a collapsing future city.',genre:'Animation · Sci-fi'},
  {title:'Finding Nemo',year:'2003',runtime:100,rating:8.2,genreIds:[16,10751,12],platforms:['Disney+'],moods:['hopeful','relaxed','happy','entertained'],age:'old',overview:'A worried father crosses the ocean in a colorful, funny journey about trust and letting go.',genre:'Animation · Adventure'},
  {title:'Dune',year:'2021',runtime:155,rating:7.8,genreIds:[878,12],platforms:['Max','Prime Video','Cinema'],moods:['amazed','thoughtful','excited'],age:'new',overview:'A young heir enters a vast desert world of prophecy, power, ecology, and political danger.',genre:'Sci-fi · Adventure'},
  {title:'Dune: Part Two',year:'2024',runtime:166,rating:8.5,genreIds:[878,12],platforms:['Cinema','Max','Prime Video'],moods:['amazed','excited','thoughtful'],age:'new',overview:'A desert uprising becomes an epic collision of faith, revenge, spectacle, and destiny.',genre:'Sci-fi · Adventure'},
  {title:'Nope',year:'2022',runtime:130,rating:6.8,genreIds:[878,27,53],platforms:['Prime Video','Cinema'],moods:['curious','amazed','excited'],age:'new',overview:'A strange presence above a California ranch turns spectacle, fear, and obsession into sci-fi mystery.',genre:'Sci-fi · Thriller'},
  {title:'The Creator',year:'2023',runtime:134,rating:6.7,genreIds:[878,28,18],platforms:['Disney+','Prime Video'],moods:['thoughtful','excited','emotional'],age:'new',overview:'A future war over artificial intelligence becomes a visually rich story about empathy and survival.',genre:'Sci-fi · Action'},
  {title:'Tenet',year:'2020',runtime:150,rating:7.2,genreIds:[878,28,53],platforms:['Prime Video'],moods:['curious','excited','thoughtful'],age:'new',overview:'A time-bending mission turns espionage into a puzzle of reversed cause, action, and consequence.',genre:'Sci-fi · Action'},
  {title:'Perfect Days',year:'2023',runtime:124,rating:7.8,genreIds:[18],platforms:['Cinema','Prime Video'],moods:['relaxed','thoughtful','hopeful'],age:'new',overview:'A quiet Tokyo cleaner finds beauty in routine, trees, music, books, and carefully noticed days.',genre:'Drama'},
  {title:'Paterson',year:'2016',runtime:118,rating:7.3,genreIds:[18,35,10749],platforms:['Prime Video','My own watchlist'],moods:['relaxed','thoughtful','hopeful'],age:'modern',overview:'A bus driver and poet moves through ordinary days with calm attention, love, and small rituals.',genre:'Drama · Comedy'},
  {title:'Kiki’s Delivery Service',year:'1989',runtime:103,rating:7.8,genreIds:[16,10751,14],platforms:['Netflix','Max'],moods:['relaxed','hopeful','happy','inspired'],age:'old',overview:'A young witch builds confidence, community, and independence in a gentle seaside city.',genre:'Animation · Family'},
  {title:'Top Gun: Maverick',year:'2022',runtime:131,rating:8.2,genreIds:[28,18],platforms:['Prime Video','Cinema'],moods:['excited','motivated','entertained'],age:'new',overview:'Elite pilots train for a dangerous mission where speed, trust, and legacy drive the momentum.',genre:'Action · Drama'}
].map(movie=>({...movie,release_date:`${movie.year}-01-01`,poster:assistantPosterImage(movie.title),trailerQuery:`${movie.title} official trailer`}));
const curatedAssistantTitles=new Set(assistantFallback.map(movie=>movie.title));

const assistantDirectorHints={
  'Arrival':'Denis Villeneuve','Interstellar':'Christopher Nolan','Her':'Spike Jonze','The Martian':'Ridley Scott','Blade Runner 2049':'Denis Villeneuve','Before Sunrise':'Richard Linklater','Whiplash':'Damien Chazelle','Mad Max: Fury Road':'George Miller','My Neighbor Totoro':'Hayao Miyazaki','Lost in Translation':'Sofia Coppola','Spider-Man: Into the Spider-Verse':'Bob Persichetti Peter Ramsey Rodney Rothman','Cinema Paradiso':'Giuseppe Tornatore','The Pursuit of Happyness':'Gabriele Muccino','Rocky':'John G. Avildsen','La La Land':'Damien Chazelle','About Time':'Richard Curtis','Ex Machina':'Alex Garland','The Social Network':'David Fincher','The Dark Knight':'Christopher Nolan','Inside Out':'Pete Docter','Everything Everywhere All at Once':'Daniel Kwan Daniel Scheinert','The Grand Budapest Hotel':'Wes Anderson','Parasite':'Bong Joon Ho','Your Name':'Makoto Shinkai','Paddington 2':'Paul King','Sing Street':'John Carney','Amélie':'Jean-Pierre Jeunet','Chef':'Jon Favreau','The Secret Life of Walter Mitty':'Ben Stiller','Soul':'Pete Docter','The Intouchables':'Olivier Nakache Éric Toledano','Little Miss Sunshine':'Jonathan Dayton Valerie Faris','Billy Elliot':'Stephen Daldry','Good Will Hunting':'Gus Van Sant','Remember the Titans':'Boaz Yakin','Hidden Figures':'Theodore Melfi','Moneyball':'Bennett Miller',"The King's Speech":'Tom Hooper','School of Rock':'Richard Linklater','Rudy':'David Anspaugh','October Sky':'Joe Johnston','The Truman Show':'Peter Weir','Mission: Impossible - Fallout':'Christopher McQuarrie','The Fabelmans':'Steven Spielberg'
};
const defaultAssistantMemory=()=>({items:{},ratings:{},saved:[],watched:[],movies:{}});
const assistantLifecycleOrder={saved:1,watched:2,rated:3};
const assistantLifecycleLabels={saved:'Saved',watched:'Watched',rated:'Rated'};
const assistantArrayValue=value=>Array.isArray(value)?value:[];
const assistantObjectValue=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const normalizeAssistantMemory=rawMemory=>{
  const memory={...defaultAssistantMemory(),...(rawMemory||{})};
  memory.items=assistantObjectValue(memory.items);
  memory.movies=assistantObjectValue(memory.movies);
  memory.ratings=assistantObjectValue(memory.ratings);
  memory.saved=assistantArrayValue(memory.saved);
  memory.watched=assistantArrayValue(memory.watched);
  const promote=(title,status)=>{
    if(!title)return;
    const current=memory.items[title]?.status||'';
    if(!current||assistantLifecycleOrder[status]>assistantLifecycleOrder[current])memory.items[title]={...(memory.items[title]||{}),status};
  };
  (memory.saved||[]).forEach(title=>promote(title,'saved'));
  (memory.watched||[]).forEach(title=>promote(title,'watched'));
  Object.entries(memory.ratings||{}).forEach(([title,score])=>{if(Number(score)>0)promote(title,'rated');});
  Object.keys(memory.items).forEach(title=>{
    const status=memory.items[title].status;
    if(status==='watching')memory.items[title]={...(memory.items[title]||{}),status:'saved'};
    if(!assistantLifecycleOrder[memory.items[title]?.status])delete memory.items[title];
  });
  memory.saved=Object.entries(memory.items).filter(([,item])=>item.status==='saved').map(([title])=>title);
  memory.watched=Object.entries(memory.items).filter(([,item])=>item.status==='watched').map(([title])=>title);
  delete memory.watching;
  return memory;
};
const getAssistantMemory=()=>{
  if(currentUserId())return normalizeAssistantMemory(authenticatedAssistantMemory);
  try{return normalizeAssistantMemory(JSON.parse(localStorage.getItem(assistantStorageKey)||'{}'));}
  catch(error){
    console.warn('Kinora library memory was reset after invalid stored data.',error);
    return defaultAssistantMemory();
  }
};
const assistantMemoryFromRows=rows=>{
  const memory=defaultAssistantMemory();
  (rows||[]).forEach(row=>{
    const title=row.title;
    if(!title)return;
    const status=row.status||'saved';
    memory.items[title]={status};
    if(status==='rated'&&Number(row.rating)>0)memory.ratings[title]=Number(row.rating);
    memory.movies[title]={
      title,
      year:row.release_year||'TBA',
      rating:Number(row.rating)||0,
      genre:(row.genre_names||[]).join(' · '),
      genreIds:row.genres||[],
      director:'',
      moods:row.mood_tags||[],
      platforms:row.platform?[row.platform]:[],
      runtime:row.runtime||0,
      overview:row.overview||'Saved in your Kinora library.',
      poster:row.poster_url||communityPosterFromPath(row.poster_path,title),
      trailerQuery:`${title} official trailer`,
      tmdbId:row.tmdb_id
    };
  });
  return normalizeAssistantMemory(memory);
};
const loadSupabaseLibrary=async ()=>{
  if(!supabaseClient||!currentUserId())return;
  const requestedUserId=currentUserId();
  const requestedRevision=authStateRevision;
  const {data,error}=await supabaseClient.from('movie_library').select('*').eq('user_id',requestedUserId).order('updated_at',{ascending:false});
  if(requestedRevision!==authStateRevision||requestedUserId!==currentUserId())return;
  if(error){console.warn('Kinora library load failed',error);return;}
  authenticatedAssistantMemory=assistantMemoryFromRows(data);
  kinoraLibraryReady=true;
  syncUserLibraryState();
  updateAssistantMemory();
};
const upsertSupabaseLibraryMovie=async (movie,status,rating=0)=>{
  if(!supabaseClient||!currentUserId()||!status){
    lastSupabaseLibraryResult={ok:false,action:'upsert',error:supabaseConfigError||'Supabase unavailable or user not signed in.'};
    return false;
  }
  const normalized=normalizeMovie(movie);
  const snapshot=assistantMovieSnapshot(movie);
  const payload={
    user_id:currentUserId(),
    tmdb_id:normalized.id||movie.tmdbId||movie.id||null,
    title:normalized.title,
    release_year:Number(normalized.year)||null,
    poster_url:normalized.poster||snapshot.poster||null,
    poster_path:movie.poster_path||null,
    status,
    rating:status==='rated'?Number(rating)||null:null,
    genres:normalized.genreIds||snapshot.genreIds||[],
    genre_names:String(normalized.genre||snapshot.genre||'').split(' · ').filter(Boolean),
    mood_tags:snapshot.moods||[],
    runtime:Number(movie.runtime||snapshot.runtime||0)||null,
    overview:normalized.overview||snapshot.overview||null,
    platform:(snapshot.platforms||[])[0]||null
  };
  const conflict=payload.tmdb_id?'user_id,tmdb_id':'user_id,title,release_year';
  const {error}=await supabaseClient.from('movie_library').upsert(payload,{onConflict:conflict});
  lastSupabaseLibraryResult={ok:!error,action:'upsert',error:error?String(error.message||error):null};
  if(error){console.warn('Kinora library save failed',error);return false;}
  return true;
};
const deleteSupabaseLibraryMovie=async movieOrTitle=>{
  if(!supabaseClient||!currentUserId()){
    lastSupabaseLibraryResult={ok:false,action:'delete',error:supabaseConfigError||'Supabase unavailable or user not signed in.'};
    return false;
  }
  const movie=typeof movieOrTitle==='string'?findAssistantMovieByTitle(movieOrTitle):movieOrTitle;
  const normalized=normalizeMovie(movie||{title:String(movieOrTitle||'')});
  const tmdbId=movie?.tmdbId||movie?.id||normalized.id||null;
  const releaseYear=Number(normalized.year)||null;
  const attempts=[];
  if(tmdbId)attempts.push({label:'tmdb_id',query:query=>query.eq('tmdb_id',tmdbId)});
  if(normalized.title&&releaseYear)attempts.push({label:'title_year',query:query=>query.eq('title',normalized.title).eq('release_year',releaseYear)});
  if(normalized.title)attempts.push({label:'title',query:query=>query.eq('title',normalized.title)});
  let deletedRows=[];
  let deleteError=null;
  for(const attempt of attempts){
    const query=attempt.query(supabaseClient.from('movie_library').delete().eq('user_id',currentUserId())).select('id,title,tmdb_id,release_year');
    const {data,error}=await query;
    if(error){
      deleteError=error;
      console.warn('Kinora library delete attempt failed',{attempt:attempt.label,error});
      continue;
    }
    if(Array.isArray(data)&&data.length){
      deletedRows=[...deletedRows,...data];
      break;
    }
  }
  const deletedOnline=deletedRows.length>0;
  lastSupabaseLibraryResult={
    ok:deletedOnline&&!deleteError,
    action:'delete',
    error:deleteError&&!deletedOnline?String(deleteError.message||deleteError):(deletedOnline?null:'No matching Supabase row was deleted.'),
    deletedRows:deletedRows.length
  };
  if(!deletedOnline){
    console.warn('Kinora library delete did not remove a Supabase row',{title:normalized.title,tmdbId,releaseYear,lastSupabaseLibraryResult});
    return false;
  }
  assistantDebug('library delete persisted',{title:normalized.title,tmdbId,releaseYear,deletedRows:deletedRows.length});
  return true;
};
const clearSupabaseMovieLibrary=async ()=>{
  if(!supabaseClient||!currentUserId()){
    lastSupabaseLibraryResult={ok:false,action:'clear',error:supabaseConfigError||'Supabase unavailable or user not signed in.'};
    return false;
  }
  const {data,error}=await supabaseClient
    .from('movie_library')
    .delete()
    .eq('user_id',currentUserId())
    .select('id,title,tmdb_id');
  const deletedRows=Array.isArray(data)?data.length:0;
  lastSupabaseLibraryResult={ok:!error,action:'clear',error:error?String(error.message||error):null,deletedRows};
  if(error){
    console.warn('Kinora library clear failed',error);
    return false;
  }
  assistantDebug('library clear persisted',{deletedRows});
  return true;
};
const clearAssistantLibraryMemory=async ()=>{
  if(!confirm('Clear your entire Kinora movie library? This cannot be undone.'))return;
  const beforeCounts=assistantStateCounts();
  assistantDebug('library clear before',{beforeCounts,loggedIn:Boolean(currentUserId())});
  let clearedOnline=true;
  if(currentUserId()){
    clearedOnline=await clearSupabaseMovieLibrary();
    if(!clearedOnline){
      await loadSupabaseLibrary();
      assistantDebug('library clear failed',{supabaseResult:lastSupabaseLibraryResult,beforeCounts,afterCounts:assistantStateCounts()});
      alert('Kinora could not clear your online movie library. Please try again.');
      return;
    }
  }
  if(!currentUserId())try{localStorage.removeItem(assistantStorageKey);}catch{}
  setAssistantMemory(defaultAssistantMemory());
  if(currentUserId())await loadSupabaseLibrary();
  updateAssistantMemory();
  preserveAssistantWall();
  if(assistantMemory)assistantMemory.textContent='Your Kinora movie library is empty.';
  alert('Your Kinora movie library has been cleared.');
  assistantDebug('library clear after',{clearedOnline,supabaseResult:lastSupabaseLibraryResult,beforeCounts,afterCounts:assistantStateCounts()});
};
const setAssistantMemory=memory=>{
  const normalized=normalizeAssistantMemory(memory);
  if(currentUserId())authenticatedAssistantMemory=normalized;
  else try{localStorage.setItem(assistantStorageKey,JSON.stringify(normalized));}catch{}
  syncUserLibraryState();
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
    delete memory.movies[normalized.title];
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
const removeAssistantMemoryItem=async (type,title)=>{
  const beforeCounts=assistantStateCounts();
  assistantDebug('library action before',{actionType:'remove',title,type,supabaseResult:lastSupabaseLibraryResult,beforeCounts});
  const next=getAssistantMemory();
  const removedMovie=next.movies?.[title]||findAssistantMovieByTitle(title);
  const previousMemory=getAssistantMemory();
  next.items={...(next.items||{})};
  next.ratings={...(next.ratings||{})};
  next.movies={...(next.movies||{})};
  delete next.items[title];
  delete next.ratings[title];
  delete next.movies[title];
  setAssistantMemory(next);
  const savedOnline=await deleteSupabaseLibraryMovie(removedMovie);
  if(currentUserId()&&!savedOnline){
    setAssistantMemory(previousMemory);
    await loadSupabaseLibrary();
  }
  preserveAssistantWall();
  if(!assistantWallHasMovieCards())recoverAssistantWallFromCandidates('library remove');
  assistantDebug('library action after',{actionType:'remove',title,type,savedOnline,supabaseResult:lastSupabaseLibraryResult,beforeCounts,afterCounts:assistantStateCounts()});
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
  const statusAction=document.createElement('button');
  statusAction.type='button';
  statusAction.className='taste-memory-remove taste-memory-status-action';
  statusAction.textContent=type==='rated'?'Unrate':type==='watched'?'WATCHED':'Unsave';
  statusAction.setAttribute('aria-label',`${statusAction.textContent} ${title} from My Library`);
  statusAction.addEventListener('click',()=>removeAssistantMemoryItem(type,title));
  item.append(titleButton,meta,statusAction);
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
  const watched=[...(memory.watched||[])].filter(matches);
  const allCount=Object.keys(memory.items||{}).length;
  assistantMemory.replaceChildren();
  if(!allCount){assistantMemory.textContent='Save, watch, or rate movies and this library will guide your recommendations.';return;}
  if(!ratings.length&&!saved.length&&!watched.length){assistantMemory.textContent='No library items match that search.';return;}
  const favorite=ratings[0]?.[0];
  const summary=document.createElement('p');
  summary.className='taste-memory-summary';
  summary.textContent=`Library active: ${ratings.length} rated, ${watched.length} watched, ${saved.length} saved${favorite?`. Strongest taste signal: “${favorite}”.`:'.'}`;
  assistantMemory.append(
    summary,
    createMemoryGroup('Rated',ratings.map(([title])=>title),'rated',memory.ratings||{},movies),
    createMemoryGroup('Watched',watched,'watched',memory.ratings||{},movies),
    createMemoryGroup('Saved',saved,'saved',memory.ratings||{},movies)
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
  if(age==='new')return year>=2019;
  if(age==='modern')return year>=2005&&year<=2018;
  if(age==='old')return year>0&&year<2005;
  return true;
};
const movieMatchesTime=(movie,time)=>{
  const runtime=Number(movie.runtime||0);
  if(time==='any')return true;
  if(!runtime)return false;
  if(time==='short')return runtime<90;
  if(time==='medium')return runtime>=90&&runtime<=140;
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
  const genreIds=movieGenreIds(movie);
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
  movie.poster_path=rawMovie.poster_path||rawMovie.posterPath||'';
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
  const candidateMovie=normalizeCategorizedMovie(candidate);
  const remembered=normalizeCategorizedMovie(memoryMovie);
  const candidateGenres=candidateMovie.genreIds||[];
  const rememberedGenres=remembered.genreIds||[];
  let score=0;
  if(candidateGenres[0]&&candidateGenres[0]===rememberedGenres[0])score+=40;
  score+=sharedCount(candidateGenres.slice(1),rememberedGenres.slice(1))*20;
  score+=sharedCount(candidateMovie.moodTags||[],remembered.moodTags||[])*15;
  score+=sharedCount(candidateMovie.toneTags||[],remembered.toneTags||[])*10;
  if(candidateMovie.decade&&candidateMovie.decade===remembered.decade)score+=8;
  if(candidateMovie.runtimeCategory&&candidateMovie.runtimeCategory===remembered.runtimeCategory)score+=5;
  const ratingGap=Math.abs(Number(candidateMovie.voteAverage||0)-Number(remembered.voteAverage||0));
  if(Number.isFinite(ratingGap)&&ratingGap<=1.2)score+=4;
  const popularityGap=Math.abs(Number(candidateMovie.popularity||0)-Number(remembered.popularity||0));
  if(Number.isFinite(popularityGap)&&popularityGap<=25)score+=2;
  return score;
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
const movieDecade=movie=>{
  const year=Number(normalizeMovie(movie).year||0);
  return year?Math.floor(year/10)*10:0;
};
const topTasteKeys=weights=>Object.entries(weights).filter(([,weight])=>weight>0).sort((a,b)=>b[1]-a[1]).map(([key])=>Number.isNaN(Number(key))?key:Number(key));
const computeAssistantTasteProfile=(memory=getAssistantMemory())=>{
  const items=memory.items||{};
  const favoriteGenreWeights={};
  const dislikedGenreWeights={};
  const favoriteMoodWeights={};
  const favoriteDecadeWeights={};
  const watchedTmdbIds=new Set();
  const savedTmdbIds=new Set();
  const ratedTmdbIds=new Set();
  const ratedTitles=new Set();
  const allLibraryTitles=new Set(Object.keys(items));
  const rememberedMovies=memory.movies||{};
  const watchedTitles=new Set([...(memory.watched||[]),...Object.entries(items).filter(([,item])=>['watched','rated'].includes(item.status)).map(([title])=>title)]);
  const savedTitles=new Set(memory.saved||[]);
  Object.entries(rememberedMovies).forEach(([title,remembered])=>{
    const normalized=normalizeMovie(remembered);
    const status=items[title]?.status||'';
    if(!status&&!Number(memory.ratings?.[title]||0))return;
    const rating=Number(memory.ratings?.[title]||0);
    const id=movieIdentityKey(remembered);
    const isWatched=watchedTitles.has(title)||status==='watched'||status==='rated';
    const isSaved=savedTitles.has(title)||status==='saved';
    const isRated=rating>0;
    if(isWatched)watchedTmdbIds.add(id);
    if(isSaved)savedTmdbIds.add(id);
    if(isRated){ratedTmdbIds.add(id);ratedTitles.add(title);allLibraryTitles.add(title);}
    const weight=isRated?ratingTasteWeight(rating):(isSaved?1.2:(isWatched?0.35:0));
    (normalized.genreIds||[]).forEach(genreId=>{
      if(weight>=0)favoriteGenreWeights[genreId]=(favoriteGenreWeights[genreId]||0)+weight;
      else dislikedGenreWeights[genreId]=(dislikedGenreWeights[genreId]||0)+Math.abs(weight);
    });
    (remembered.moods||remembered.moodTags||[]).forEach(tag=>{
      if(weight>0)favoriteMoodWeights[tag]=(favoriteMoodWeights[tag]||0)+weight;
    });
    const decade=movieDecade(remembered);
    if(decade&&weight>0)favoriteDecadeWeights[decade]=(favoriteDecadeWeights[decade]||0)+weight;
  });
  return {
    favoriteGenreIds:topTasteKeys(favoriteGenreWeights),
    favoriteMoodTags:topTasteKeys(favoriteMoodWeights),
    favoriteDecades:topTasteKeys(favoriteDecadeWeights),
    dislikedGenreIds:topTasteKeys(dislikedGenreWeights),
    watchedTmdbIds,
    savedTmdbIds,
    ratedTmdbIds,
    favoriteGenreWeights,
    dislikedGenreWeights,
    favoriteMoodWeights,
    favoriteDecadeWeights,
    watchedTitles,
    savedTitles,
    ratedTitles,
    allLibraryTitles,
    signalCount:allLibraryTitles.size
  };
};
const isAssistantLibraryExactMatch=(movie,profile)=>{
  const normalized=normalizeMovie(movie);
  const key=movieIdentityKey(movie);
  return profile.allLibraryTitles.has(normalized.title)||
    profile.watchedTmdbIds.has(key)||
    profile.savedTmdbIds.has(key)||
    profile.ratedTmdbIds.has(key);
};
const personalizeAssistantMovie=(movie,memory,profile=computeAssistantTasteProfile(memory))=>{
  const normalized=normalizeMovie(movie);
  const candidateId=movieIdentityKey(movie);
  let score=0;
  const reasons=[];
  if(profile.ratedTmdbIds.has(candidateId)||profile.ratedTitles.has(normalized.title)||profile.watchedTmdbIds.has(candidateId)||profile.watchedTitles.has(normalized.title)){
    score-=90;
  }else if(profile.savedTmdbIds.has(candidateId)||profile.savedTitles.has(normalized.title)){
    score-=45;
  }
  (normalized.genreIds||[]).forEach(genreId=>{
    const favoriteWeight=Number(profile.favoriteGenreWeights[genreId]||0);
    const dislikedWeight=Number(profile.dislikedGenreWeights[genreId]||0);
    if(favoriteWeight>0){
      score+=Math.min(34,favoriteWeight*2.9);
      reasons.push(genreNames[genreId]||'a favorite genre');
    }
    if(dislikedWeight>0)score-=Math.min(28,dislikedWeight*3.4);
  });
  (movie.moods||movie.moodTags||[]).forEach(tag=>{
    const weight=Number(profile.favoriteMoodWeights[tag]||0);
    if(weight>0){
      score+=Math.min(18,weight*2);
      reasons.push(`${tag} films`);
    }
  });
  const decade=movieDecade(movie);
  if(decade&&profile.favoriteDecadeWeights[decade]){
    score+=Math.min(10,profile.favoriteDecadeWeights[decade]*1.1);
    reasons.push(`${decade}s films`);
  }
  const rememberedMovies=memory.movies||{};
  Object.entries(rememberedMovies).forEach(([title,remembered])=>{
    if(!memory.items?.[title]&&!Number(memory.ratings?.[title]||0))return;
    const similarity=movieSimilarityScore(movie,remembered);
    if(!similarity)return;
    const rating=Number(memory.ratings?.[title]||0);
    if(rating>0){
      score+=similarity*ratingTasteWeight(rating)*.95;
    }else if(profile.savedTitles.has(title)){
      score+=similarity*.75;
    }
  });
  return {score,reasons:[...new Set(reasons)].slice(0,3),profile};
};
const tasteMemoryScore=(movie,memory)=>personalizeAssistantMovie(movie,memory).score;
const runtimePreferenceScore=(movie,time)=>{
  const runtime=Number(movie.runtime||0);
  if(time==='any'||!runtime)return 0;
  if(time==='short')return runtime<90?8:Math.max(-7,(95-runtime)/5);
  if(time==='medium')return runtime>=90&&runtime<=140?8:Math.max(-7,8-(Math.min(Math.abs(runtime-100),Math.abs(runtime-130))*.25));
  if(time==='long')return runtime>140?8:Math.max(-6,(runtime-130)/5);
  return 0;
};
const genrePreferenceScore=(movie,genre)=>{
  if(genre==='any')return 0;
  const genreIds=movieGenreIds(movie);
  return genreIds.includes(Number(genre))?10:-3;
};
const platformPreferenceScore=(movie,platform)=>normalizePlatform(platform)?(movieMatchesPlatform(movie,platform)?8:-4):0;
const releasePreferenceScore=(movie,age)=>age==='any'?0:(movieMatchesAge(movie,age)?7:-4);
const assistantAgeLabels={old:'older classic',modern:'modern classic',new:'newer movie'};
const assistantTimeLabels={short:'Under 90 minutes',medium:'90–140 minutes',long:'More than 140 minutes'};
const assistantDiscoverMaxPages=50;
const assistantDiscoverBatchSize=20;
const assistantCacheKey='cinemaMovieMatchCandidateCacheV6';
const assistantStaticPackageUrl=`${siteRoot}data/movie-match-candidates.json?v=4500`;
const assistantCacheTtl=24*60*60*1000;
const assistantCacheMinimum=4000;
const assistantCacheTarget=4500;
let assistantMovieCache=[];
let assistantCachePromise=null;
let currentAssistantRecommendations=[];
let lastVisibleAssistantRecommendations=[];
let assistantStaticPackageCache=null;
let assistantStaticPackagePromise=null;
let movieCandidates=assistantMovieCache;
let currentRecommendations=currentAssistantRecommendations;
let previousResultIds=new Set();
let recentlyShownIds=[];
let userLibrary=defaultAssistantMemory();
let savedMovies=[];
let watchedMovies=[];
let ratedMovies={};
let lastSupabaseLibraryResult={ok:null,action:'none',error:null};
const syncUserLibraryState=()=>{
  userLibrary=getAssistantMemory();
  savedMovies=[...(userLibrary.saved||[])];
  watchedMovies=[...(userLibrary.watched||[])];
  ratedMovies={...(userLibrary.ratings||{})};
  return userLibrary;
};
const setMovieCandidates=movies=>{
  assistantMovieCache=uniqueAssistantMovies((movies||[]).map(movie=>normalizeAssistantCacheMovie(movie)));
  movieCandidates=assistantMovieCache;
  window.movieCandidates=movieCandidates;
  return assistantMovieCache;
};
const setCurrentRecommendations=movies=>{
  currentAssistantRecommendations=[...(movies||[])];
  currentRecommendations=currentAssistantRecommendations;
  window.currentRecommendations=currentRecommendations;
  return currentAssistantRecommendations;
};
const assistantDebug=(label,payload={})=>{
  const message=`Movie Match ${label}: ${JSON.stringify(payload)}`;
  console.log(message);
  window.movieMatchDebug=[...(window.movieMatchDebug||[]),{label,payload,recordedAt:new Date().toISOString()}].slice(-80);
};
const assistantDataSourceLog=(source,payload={})=>{
  window.movieMatchActiveDataSource=source;
  assistantDebug('data source',{source,tmdbProxyAvailable:tmdbAvailable,...payload});
};
const selectedGenreId=answers=>answers.genre==='any'?0:Number(answers.genre||0);
const debugGenreFilterResult=(movie,answers,context='genre filter')=>{
  const selectedId=selectedGenreId(answers);
  if(!selectedId)return;
  const normalized=normalizeMovie(movie);
  const genreIds=movieGenreIds(movie);
  assistantDebug(context,{
    title:normalized.title,
    selectedGenreId:selectedId,
    selectedGenreName:genreNames[selectedId]||String(selectedId),
    movieGenreIds:genreIds,
    movieGenreNames:genreIds.map(id=>genreNames[id]||String(id)),
    passedGenreFilter:genreIds.includes(selectedId)
  });
};
const movieHasSelectedGenre=(movie,answers)=>{
  const genreId=selectedGenreId(answers);
  const genreIds=movieGenreIds(movie);
  return !genreId||genreIds.includes(genreId);
};
const movieHasSelectedAge=(movie,answers)=>answers.age==='any'||movieMatchesAge(movie,answers.age);
const movieHasSelectedRuntime=(movie,answers)=>answers.time==='any'||movieMatchesTime(movie,answers.time);
const movieHasSelectedPlatform=(movie,answers,memory)=>{
  const platform=normalizePlatform(answers.platform);
  if(!platform)return true;
  return platformValues(movie).length>0&&movieMatchesPlatform(movie,answers.platform);
};
const assistantLibraryMovies=memory=>{
  const movies=memory.movies||{};
  return Object.keys(memory.items||{}).map(title=>movies[title]||findAssistantMovieByTitle(title)).filter(movie=>normalizeMovie(movie).title);
};
const strictAssistantCandidate=(movie,answers,memory)=>{
  const normalized=normalizeMovie(movie);
  if(!normalized.title)return false;
  if(!movieHasSelectedGenre(normalized,answers))return false;
  if(!movieHasSelectedAge(normalized,answers))return false;
  if(!movieHasSelectedRuntime({...normalized,runtime:movie.runtime},answers))return false;
  if(!movieHasSelectedPlatform(movie,answers,memory))return false;
  return true;
};
const assistantHasPlatformData=movie=>platformValues(movie).length>0;
const filterAssistantCandidates=(candidates,answers,memory,{context='filter pipeline'}={})=>{
  const selectedPlatform=normalizePlatform(answers.platform);
  const source=uniqueAssistantMovies(candidates).map(movie=>normalizeAssistantCacheMovie(movie)).filter(movie=>normalizeMovie(movie).title);
  const afterGenre=source.filter(movie=>movieHasSelectedGenre(movie,answers));
  const afterYear=afterGenre.filter(movie=>movieHasSelectedAge(movie,answers));
  const afterRuntime=afterYear.filter(movie=>movieHasSelectedRuntime({...normalizeMovie(movie),runtime:movie.runtime},answers));
  let afterPlatform=afterRuntime;
  let platformSkipped=false;
  const platformDataCount=afterRuntime.filter(assistantHasPlatformData).length;
  if(selectedPlatform&&selectedPlatform!=='library'){
    if(platformDataCount){
      afterPlatform=afterRuntime.filter(movie=>movieHasSelectedPlatform(movie,answers,memory));
    }else{
      platformSkipped=true;
      console.info('Platform filter skipped: no platform data available.');
    }
  }
  const hiddenRadar=radarHiddenRecords();
  const afterNotInterested=hiddenRadar.length?afterPlatform.filter(movie=>{
    const normalized=normalizeMovie(movie);
    return !hiddenRadar.some(record=>String(record.title||'').toLowerCase()===normalized.title.toLowerCase());
  }):afterPlatform;
  const counts={
    dataSource:window.movieMatchActiveDataSource||'unknown',
    loggedIn:Boolean(currentUserId()),
    selectedGenreId:selectedGenreId(answers)||null,
    selectedGenreName:genreNames[selectedGenreId(answers)]||'Any genre',
    selectedYear:answers.age||'any',
    selectedRuntime:answers.time||'any',
    selectedPlatform:answers.platform||'any',
    candidateCountBeforeFiltering:source.length,
    countAfterGenreFilter:afterGenre.length,
    countAfterYearFilter:afterYear.length,
    countAfterRuntimeFilter:afterRuntime.length,
    countAfterPlatformFilter:afterPlatform.length,
    countAfterNotInterestedFilter:afterNotInterested.length,
    platformDataCount,
    platformSkipped,
    libraryCount:Object.keys(memory.items||{}).length
  };
  assistantDebug(context,counts);
  return {movies:afterNotInterested,counts};
};
const validateAssistantPool=(movies,answers,memory)=>{
  const valid=filterAssistantCandidates(movies,answers,memory,{context:'final render filter guard'}).movies;
  if(valid.length!==movies.length){
    assistantDebug('removed invalid results',{answers,removed:movies.filter(movie=>!valid.includes(movie)).map(movie=>normalizeMovie(movie).title)});
  }
  return valid;
};
const scoreAssistantMovieDetailed=(movie,answers,memory,profile=computeAssistantTasteProfile(memory))=>{
  const normalized=normalizeMovie(movie);
  const reasons=[];
  const hasTasteSignals=Boolean(profile.signalCount||profile.favoriteGenreIds.length||profile.favoriteMoodTags.length||profile.favoriteDecades.length||profile.dislikedGenreIds.length);
  let baseScore=Number(normalized.rating||movie.vote_average||0)*1.4+Math.min(Number(movie.popularity||0),100)*.12;
  if(curatedAssistantTitles.has(normalized.title))baseScore+=hasTasteSignals?4:14;
  const genreId=selectedGenreId(answers);
  if(genreId){
    baseScore+=30;
    reasons.push(genreNames[genreId]||'selected genre');
  }
  if(answers.age!=='any'){
    baseScore+=18;
    reasons.push(assistantAgeLabels[answers.age]);
  }
  if(answers.time!=='any'){
    baseScore+=12;
    reasons.push(assistantTimeLabels[answers.time]);
  }
  const platform=normalizePlatform(answers.platform);
  if(platform&&platform!=='library'){
    const platformKnown=platformValues(movie).length>0;
    if(movieMatchesPlatform(movie,answers.platform)){baseScore+=10;reasons.push(`${answers.platform} availability`);}
    else if(platformKnown)baseScore-=10;
  }else if(platform==='library'){
    const title=normalized.title;
    if(memory.items?.[title]||memory.movies?.[title]){
      baseScore+=8;
      reasons.push('your library');
    }
  }
  const moodScore=moodTransitionScore(movie,answers);
  baseScore+=moodScore*1.65;
  if(answers.currentMood!=='any'||answers.targetMood!=='any'){
    const path=[answers.currentMood,answers.targetMood].filter(value=>value&&value!=='any').join(' to ');
    reasons.push(`${path} mood path`);
  }
  const personalization=personalizeAssistantMovie(movie,memory,profile);
  if(personalization.score>=3)reasons.push('your Kinora library');
  const score=baseScore+personalization.score;
  return {
    movie:{
      ...movie,
      assistantScore:score,
      assistantBaseScore:baseScore,
      assistantPersonalizationScore:personalization.score,
      assistantReason:assistantMovieReason(answers,reasons),
      assistantPersonalReason:assistantPersonalReason(personalization.reasons)
    },
    score,
    baseScore,
    personalizationScore:personalization.score,
    reasons
  };
};
const scoreAssistantMovie=(movie,answers,memory)=>scoreAssistantMovieDetailed(movie,answers,memory).score;
const assistantPersonalReason=reasons=>{
  const cleaned=[...new Set((reasons||[]).filter(Boolean))].slice(0,3);
  return cleaned.length?`Because you liked: ${cleaned.join(', ')}`:'';
};
const assistantMovieReason=(answers,reasons=[])=>{
  const cleaned=[...new Set(reasons.filter(Boolean))].slice(0,4);
  if(!cleaned.length)return 'Recommended as one of the strongest overall matches.';
  return `Matches ${cleaned.join(', ')}.`;
};
const assistantExplanation=(answers,movies)=>{
  const genreLabel=answers.genre==='any'?'a surprise genre':(genreNames[answers.genre]||'your selected genre');
  const titles=movies.map(movie=>movie.title).join(', ');
  const memory=getAssistantMemory();
  const topRated=Object.entries(memory.ratings||{}).filter(([,score])=>Number(score)>=8).map(([title])=>title)[0];
  const ageLabel=answers.age==='any'?'any release era':assistantAgeLabels[answers.age];
  return `Mood path: ${answers.currentMood} → ${answers.targetMood}. Strict filters applied: ${genreLabel}, ${ageLabel}, runtime, platform, and My Library. ${topRated?`Because you rated “${topRated}” highly, similar films receive extra weight. `:''}Best choices: ${titles}.`;
};
const closestAssistantExplanation=(answers,movies)=>{
  const titles=movies.map(movie=>movie.title).join(', ');
  return `Closest strict matches for ${answers.currentMood} → ${answers.targetMood}. Genre and release-era filters stay enforced while the engine ranks the best remaining mood matches: ${titles}.`;
};
const updateAssistantPersonalizationNote=(profile=computeAssistantTasteProfile(getAssistantMemory()))=>{
  if(!assistantPersonalizationNote)return;
  const active=profile.favoriteGenreIds.length||profile.favoriteMoodTags.length||profile.favoriteDecades.length||profile.dislikedGenreIds.length||profile.watchedTmdbIds.size||profile.savedTmdbIds.size||profile.ratedTmdbIds.size;
  assistantPersonalizationNote.hidden=!active;
  assistantPersonalizationNote.textContent=active?'Personalized using your Kinora library':'';
};
const assistantCacheKeyForMovie=movie=>String(movie.tmdbId||movie.id||`${movie.title}-${movie.year||movie.release_date||''}`).toLowerCase();
const normalizeAssistantCacheMovie=(rawMovie,platform='')=>{
  const enriched=enrichAssistantMovie(rawMovie||{},platform);
  const movie=normalizeCategorizedMovie(enriched);
  return {
    ...movie,
    platforms:platform?[platform]:(rawMovie?.platforms||(rawMovie?.platform?[rawMovie.platform]:movie.platforms||[])),
    age:rawMovie?.age||movie.age,
    trailerQuery:movie.trailerQuery||`${movie.title} official trailer`
  };
};
const loadAssistantMovieCache=()=>{
  if(assistantMovieCache.length)return assistantMovieCache;
  try{
    const cached=JSON.parse(localStorage.getItem(assistantCacheKey)||'{}');
    if(cached.expiresAt>Date.now()&&Array.isArray(cached.movies)){
      const restored=cached.movies.map(movie=>normalizeAssistantCacheMovie(movie));
      const usable=restored.filter(movie=>movie.title&&movieGenreIds(movie).length&&Number(movie.runtime||0)>0);
      if(usable.length>=Math.min(5,restored.length)){
        setMovieCandidates(usable);
        assistantDebug('cache restored',{cacheSize:assistantMovieCache.length,expiresAt:cached.expiresAt});
      }else{
        localStorage.removeItem(assistantCacheKey);
        assistantDebug('cache ignored',{reason:'missing genre or runtime data',cacheSize:restored.length,usableCount:usable.length});
      }
    }
  }catch(error){assistantDebug('cache restore failed',{message:String(error)});}
  return assistantMovieCache;
};
const saveAssistantMovieCache=movies=>{
  setMovieCandidates(movies);
  const compact=movies.map(movie=>({
    tmdbId:movie.tmdbId||movie.id,
    id:movie.id||movie.tmdbId,
    title:movie.title,
    year:movie.year,
    releaseDate:movie.releaseDate||movie.release_date,
    release_date:movie.releaseDate||movie.release_date,
    rating:Number(movie.rating||movie.vote_average||movie.voteAverage||0),
    voteAverage:Number(movie.voteAverage||movie.vote_average||movie.rating||0),
    vote_average:Number(movie.vote_average||movie.voteAverage||movie.rating||0),
    popularity:Number(movie.popularity||0),
    overview:String(movie.overview||'').slice(0,260),
    poster_path:movie.poster_path,
    poster:movie.poster,
    genreIds:movie.genreIds||[],
    genre:movie.genre,
    runtime:Number(movie.runtime||0),
    moods:movie.moods||movie.moodTags||[],
    platforms:movie.platforms||[]
  }));
  try{
    localStorage.setItem(assistantCacheKey,JSON.stringify({version:2,createdAt:Date.now(),expiresAt:Date.now()+assistantCacheTtl,movies:compact}));
  }catch(error){assistantDebug('cache save skipped',{cacheSize:compact.length,message:String(error)});}
};
const compactAssistantWallMovie=movie=>{
  const normalized=normalizeAssistantCacheMovie(movie);
  return {
    tmdbId:normalized.tmdbId||normalized.id,
    id:normalized.id||normalized.tmdbId,
    title:normalized.title,
    year:normalized.year,
    releaseDate:normalized.releaseDate||normalized.release_date,
    release_date:normalized.releaseDate||normalized.release_date,
    rating:Number(normalized.rating||normalized.vote_average||normalized.voteAverage||0),
    voteAverage:Number(normalized.voteAverage||normalized.vote_average||normalized.rating||0),
    vote_average:Number(normalized.vote_average||normalized.voteAverage||normalized.rating||0),
    popularity:Number(normalized.popularity||0),
    overview:String(normalized.overview||'').slice(0,320),
    poster_path:normalized.poster_path,
    poster:normalized.poster,
    genreIds:normalized.genreIds||[],
    genre:normalized.genre,
    runtime:Number(normalized.runtime||0),
    moods:normalized.moods||normalized.moodTags||[],
    platforms:normalized.platforms||[]
  };
};
const saveLastVisibleAssistantWall=movies=>{
  if(!movies?.length)return;
  try{
    localStorage.setItem(assistantLastVisibleKey,JSON.stringify({createdAt:Date.now(),movies:movies.map(compactAssistantWallMovie)}));
  }catch(error){assistantDebug('last visible wall save skipped',{message:String(error)});}
};
const loadLastVisibleAssistantWall=()=>{
  try{
    const stored=JSON.parse(localStorage.getItem(assistantLastVisibleKey)||'{}');
    return Array.isArray(stored.movies)?stored.movies.map(movie=>normalizeAssistantCacheMovie(movie)).filter(movie=>normalizeMovie(movie).title):[];
  }catch(error){
    assistantDebug('last visible wall restore failed',{message:String(error)});
    return [];
  }
};
const normalizeStaticMoviePackageMovie=movie=>normalizeAssistantCacheMovie({
  ...movie,
  genreIds:movie.genre_ids||movie.genreIds||[],
  genre:movie.genreNames?.join(' · ')||movie.genre,
  voteAverage:movie.vote_average,
  vote_average:movie.vote_average,
  releaseDate:movie.release_date,
  release_date:movie.release_date
});
const loadAssistantStaticPackage=async ()=>{
  if(assistantStaticPackageCache)return assistantStaticPackageCache;
  if(assistantStaticPackagePromise)return assistantStaticPackagePromise;
  assistantStaticPackagePromise=fetch(assistantStaticPackageUrl,{cache:'no-cache'})
    .then(response=>{
      if(!response.ok)throw new Error(`Static package unavailable: ${response.status}`);
      return response.json();
    })
    .then(packageData=>{
      const rawMovies=packageData.movies||[];
      const movies=rawMovies.map(normalizeStaticMoviePackageMovie).filter(movie=>movie.title&&movieGenreIds(movie).length);
      assistantStaticPackageCache=mergeAssistantMovieSets(movies);
      if(!movieCandidates.length)setMovieCandidates(assistantStaticPackageCache);
      assistantDataSourceLog('static content package',{
        packageCount:packageData.count||rawMovies.length,
        totalMoviesLoadedFromStaticPackage:rawMovies.length,
        totalCandidatesAfterNormalization:movies.length,
        candidateCount:assistantStaticPackageCache.length,
        genreCoverage:packageData.genreCoverage||null
      });
      return assistantStaticPackageCache;
    })
    .catch(error=>{
      assistantDebug('static package failed',{url:assistantStaticPackageUrl,message:String(error)});
      assistantStaticPackageCache=[];
      return [];
    })
    .finally(()=>{assistantStaticPackagePromise=null;});
  return assistantStaticPackagePromise;
};
const mergeAssistantMovieSets=(...sets)=>{
  const byId=new Map();
  let duplicates=0;
  sets.flat().filter(Boolean).forEach(movie=>{
    const normalized=normalizeAssistantCacheMovie(movie);
    const key=assistantCacheKeyForMovie(normalized);
    if(byId.has(key)){
      duplicates++;
      const existing=byId.get(key);
      byId.set(key,{
        ...existing,
        ...normalized,
        runtime:Number(normalized.runtime||0)||Number(existing.runtime||0)||0,
        genreIds:[...new Set([...(existing.genreIds||[]),...(normalized.genreIds||[])])],
        genres:[...new Set([...(existing.genres||[]),...(normalized.genres||[])])],
        moods:[...new Set([...(existing.moods||[]),...(normalized.moods||[])])],
        moodTags:[...new Set([...(existing.moodTags||[]),...(normalized.moodTags||[])])],
        platforms:[...new Set([...(existing.platforms||[]),...(normalized.platforms||[])])],
        poster_path:normalized.poster_path||existing.poster_path,
        poster:normalized.poster&&!String(normalized.poster).startsWith('data:')?normalized.poster:existing.poster||normalized.poster,
        posterUrl:normalized.posterUrl&&!String(normalized.posterUrl).startsWith('data:')?normalized.posterUrl:existing.posterUrl||normalized.posterUrl,
        overview:normalized.overview&&normalized.overview!=='Details will be announced closer to release.'?normalized.overview:existing.overview||normalized.overview,
        vote_average:Number(normalized.vote_average||0)||Number(existing.vote_average||0)||0,
        voteAverage:Number(normalized.voteAverage||0)||Number(existing.voteAverage||0)||0,
        popularity:Number(normalized.popularity||0)||Number(existing.popularity||0)||0
      });
    }else{
      byId.set(key,normalized);
    }
  });
  const movies=[...byId.values()];
  assistantDebug('duplicate removal',{inputCount:sets.flat().filter(Boolean).length,duplicates,cacheSize:movies.length});
  return movies;
};
const assistantDiscoverStrategies=()=>{
  const today=new Date().toISOString().slice(0,10);
  const base={include_adult:'false','primary_release_date.lte':today};
  const strategies=[
    {name:'popular',pages:25,params:{...base,sort_by:'popularity.desc','vote_count.gte':'50'}},
    {name:'high-rated',pages:25,params:{...base,sort_by:'vote_average.desc','vote_count.gte':'300'}},
    {name:'older-classics',pages:20,params:{...base,sort_by:'vote_average.desc','vote_count.gte':'120','primary_release_date.lte':'2004-12-31'}},
    {name:'modern',pages:20,params:{...base,sort_by:'popularity.desc','vote_count.gte':'80','primary_release_date.gte':'2005-01-01','primary_release_date.lte':'2018-12-31'}},
    {name:'newer',pages:20,params:{...base,sort_by:'popularity.desc','vote_count.gte':'40','primary_release_date.gte':'2019-01-01'}}
  ];
  Object.keys(tmdbGenreNames).map(Number).forEach(genreId=>{
    strategies.push({name:`genre-${genreId}`,pages:5,params:{...base,sort_by:'popularity.desc','vote_count.gte':'30',with_genres:String(genreId)}});
  });
  return strategies;
};
const fetchAssistantDiscoverPool=async ()=>{
  if(!tmdbAvailable)throw new Error('TMDB proxy not configured');
  assistantDebug('TMDb proxy available',{available:tmdbAvailable});
  const strategies=assistantDiscoverStrategies();
  const requests=strategies.flatMap(strategy=>Array.from({length:strategy.pages},(_,index)=>({strategy:strategy.name,page:index+1,params:{...strategy.params,page:String(index+1)}})));
  const movies=[];
  for(let index=0;index<requests.length;index+=assistantDiscoverBatchSize){
    const batch=requests.slice(index,index+assistantDiscoverBatchSize);
    assistantDebug('TMDb request URLs',{batch:index/assistantDiscoverBatchSize+1,urls:batch.map(request=>tmdbUrl('/discover/movie',request.params).toString())});
    const responses=await Promise.all(batch.map(request=>tmdb('/discover/movie',request.params).catch(error=>{
      console.warn('Movie Match TMDb page failed:',{strategy:request.strategy,page:request.page,error});
      return {results:[]};
    })));
    movies.push(...responses.flatMap(data=>data.results||[]));
  }
  const merged=mergeAssistantMovieSets(movies).slice(0,assistantCacheTarget);
  assistantDebug('TMDb fetched movies',{strategyCount:strategies.length,rawFetched:movies.length,uniqueFetched:merged.length});
  return merged;
};
const assistantYearParams=answers=>{
  if(answers.age==='old')return {'primary_release_date.lte':'2004-12-31'};
  if(answers.age==='modern')return {'primary_release_date.gte':'2005-01-01','primary_release_date.lte':'2018-12-31'};
  if(answers.age==='new')return {'primary_release_date.gte':'2019-01-01'};
  return {};
};
const fetchAssistantExactGenrePool=async answers=>{
  const genreId=selectedGenreId(answers);
  if(!tmdbAvailable||!genreId)return [];
  const today=new Date().toISOString().slice(0,10);
  const base={include_adult:'false','primary_release_date.lte':today,sort_by:'popularity.desc','vote_count.gte':'20',with_genres:String(genreId),...assistantYearParams(answers)};
  const requests=Array.from({length:8},(_,index)=>({...base,page:String(index+1)}));
  assistantDebug('TMDb exact genre request URLs',{selectedGenreId:genreId,selectedGenreName:genreNames[genreId],urls:requests.map(params=>tmdbUrl('/discover/movie',params).toString())});
  const responses=await Promise.all(requests.map(params=>tmdb('/discover/movie',params).catch(error=>{
    console.warn('Movie Match exact genre page failed:',{genreId,error});
    return {results:[]};
  })));
  const fetched=mergeAssistantMovieSets(responses.flatMap(data=>data.results||[]));
  assistantDebug('TMDb exact genre fetched',{selectedGenreId:genreId,selectedGenreName:genreNames[genreId],count:fetched.length});
  return fetched;
};
const warmAssistantMovieCache=async ({force=false}={})=>{
  const cached=loadAssistantMovieCache();
  if(!force&&cached.length>=assistantCacheMinimum){assistantDataSourceLog('cache',{candidateCount:cached.length});return cached;}
  if(assistantCachePromise)return assistantCachePromise;
  assistantCachePromise=(async ()=>{
    if(!tmdbAvailable){
      assistantDataSourceLog('static content package',{reason:'TMDb proxy unavailable'});
      const staticMovies=await loadAssistantStaticPackage();
      if(staticMovies.length){setMovieCandidates(staticMovies);return staticMovies;}
      assistantDataSourceLog('fallback',{reason:'TMDb proxy and static package unavailable'});
      return setMovieCandidates(assistantFallback.map(movie=>normalizeAssistantCacheMovie(movie)));
    }
    assistantDataSourceLog('TMDB',{status:'fetching',tmdbProxyAvailable:tmdbAvailable});
    assistantDebug('cache fetch status',{status:'fetching',currentSize:cached.length,target:assistantCacheTarget});
    const fetched=await fetchAssistantDiscoverPool();
    const merged=mergeAssistantMovieSets(cached,fetched);
    saveAssistantMovieCache(merged);
    assistantDataSourceLog('TMDB',{candidateCount:merged.length});
    assistantDebug('cache fetch status',{status:'ready',cacheSize:merged.length});
    return merged;
  })().catch(error=>{
    assistantDebug('cache fetch status',{status:'failed',message:String(error)});
    const restored=loadAssistantMovieCache();
    if(restored.length){setMovieCandidates(restored);assistantDataSourceLog('cache',{candidateCount:restored.length,reason:'TMDb fetch failed'});return restored;}
    return loadAssistantStaticPackage().then(staticMovies=>{
      if(staticMovies.length){setMovieCandidates(staticMovies);assistantDataSourceLog('static content package',{candidateCount:staticMovies.length,reason:'TMDb fetch failed'});return staticMovies;}
      assistantDataSourceLog('fallback',{reason:'TMDb fetch and static package failed'});
      return setMovieCandidates(assistantFallback.map(movie=>normalizeAssistantCacheMovie(movie)));
    });
  }).finally(()=>{assistantCachePromise=null;});
  return assistantCachePromise;
};
const exactMovieTitleKey=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const seededCommunityReviews=[
  {movie:'Dune: Part Two',tmdbId:'693134',releaseYear:'2024'},
  {movie:'Perfect Days',tmdbId:'976893',releaseYear:'2023'},
  {movie:'Past Lives',tmdbId:'666277',releaseYear:'2023'},
  {movie:'Dogville',tmdbId:'553',releaseYear:'2003'}
];
const communityReviewRecordMatchesMovie=(record,movie)=>{
  if(!record||!movie)return false;
  const movieTmdbId=String(movie.tmdbId||movie.id||'').trim();
  if(movieTmdbId&&String(record.tmdbId||record.id||'').trim()===movieTmdbId)return true;
  const movieTitle=exactMovieTitleKey(movie.title);
  const reviewTitle=exactMovieTitleKey(record.movie||record.title);
  const movieYear=String(movie.year||'').trim();
  const reviewYear=String(record.releaseYear||record.year||'').trim();
  return !!movieTitle&&movieTitle===reviewTitle&&!!movieYear&&movieYear===reviewYear;
};
const communityReviewRecordFromCard=card=>({
  movie:card.dataset.movie,
  tmdbId:card.dataset.tmdbId,
  releaseYear:card.dataset.releaseYear
});
const communityReviewRecords=()=>[
  ...seededCommunityReviews,
  ...[...document.querySelectorAll('.memory-case')].map(communityReviewRecordFromCard),
  ...savedCommunityMemories()
];
const communityReviewsForMovie=movie=>communityReviewRecords().filter(record=>communityReviewRecordMatchesMovie(record,movie));
const communityReviewUrlForMovie=movie=>{
  const title=encodeURIComponent(movie.title||'');
  return `${siteRoot}journal/?review=${title}#community`;
};
const assistantStateCounts=()=>({
  movieCandidatesCount:movieCandidates.length||assistantMovieCache.length||loadAssistantMovieCache().length||assistantFallback.length,
  currentRecommendationsCount:assistantResults?.querySelectorAll('.wall-poster').length||currentRecommendations.length||currentAssistantRecommendations.length||0,
  userLibraryCount:Object.keys(syncUserLibraryState().items||{}).length,
  savedCount:savedMovies.length,
  watchedCount:watchedMovies.length,
  ratedCount:Object.keys(ratedMovies||{}).filter(title=>Number(ratedMovies[title])>0).length,
  authUser:Boolean(authUser||currentUserId())
});
const assistantWallHasMovieCards=()=>!!assistantResults?.querySelector('.wall-poster');
const showAssistantWallEmpty=message=>{
  if(!assistantResults)return;
  const empty=document.createElement('p');
  empty.className='assistant-wall-empty';
  empty.textContent=message;
  assistantResults.replaceChildren(empty);
  setCurrentRecommendations([]);
};
const recoverAssistantWallFromCandidates=async reason=>{
  if(!assistantResults||assistantWallHasMovieCards())return true;
  const answers=getAssistantFilters();
  const memory=getAssistantMemory();
  const sources=[
    lastVisibleAssistantRecommendations,
    loadLastVisibleAssistantWall(),
    currentAssistantRecommendations,
    currentRecommendations,
    assistantMovieCache,
    loadAssistantMovieCache(),
    await loadAssistantStaticPackage(),
    assistantFallback
  ];
  for(const source of sources){
    if(!source?.length)continue;
    const {pool}=getAssistantMoviePool(source,answers,memory,{different:true});
    if(pool.length&&renderPosterWall(pool,{preserveOnEmpty:true})){
      assistantDebug('recovered empty wall',{reason,recoveredCount:pool.length});
      return true;
    }
  }
  showAssistantWallEmpty('No exact matches found. Try changing one filter.');
  assistantDebug('empty wall recovery failed',{reason,...assistantStateCounts()});
  return false;
};
let assistantRecoveryTimer=0;
const scheduleAssistantWallRecovery=reason=>{
  if(!assistantPanel||assistantPanel.hidden||assistantWallHasMovieCards())return;
  clearTimeout(assistantRecoveryTimer);
  assistantRecoveryTimer=setTimeout(()=>{recoverAssistantWallFromCandidates(reason);},120);
};
const preserveAssistantWall=()=>{
  if(!assistantResults)return;
  if(!assistantWallHasMovieCards()&&lastVisibleAssistantRecommendations.length){
    assistantDebug('restoring visible recommendations',{...assistantStateCounts(),restoredCount:lastVisibleAssistantRecommendations.length});
    renderPosterWall(lastVisibleAssistantRecommendations,{skipValidation:true});
  }
  scheduleAssistantWallRecovery('preserve wall');
};
const rescoreAssistantWallSafely=async reason=>{
  if(!assistantPanel||assistantPanel.hidden||!assistantResults)return false;
  const answers=getAssistantFilters();
  const memory=getAssistantMemory();
  const sources=[
    movieCandidates,
    assistantMovieCache,
    loadAssistantMovieCache(),
    await loadAssistantStaticPackage(),
    assistantFallback
  ];
  for(const source of sources){
    if(!source?.length)continue;
    try{
      const {pool}=getAssistantMoviePool(source,answers,memory,{different:false});
      if(pool.length&&renderPosterWall(pool,{preserveOnEmpty:true})){
        assistantDebug('rescored wall after action',{reason,recommendationCount:pool.length,...assistantStateCounts()});
        return true;
      }
    }catch(error){
      assistantDebug('rescore source failed',{reason,message:String(error),sourceCount:source.length});
    }
  }
  preserveAssistantWall();
  assistantDebug('rescore kept existing wall',{reason,...assistantStateCounts()});
  return assistantWallHasMovieCards();
};
const mutateAssistantLibrary=async ({movie,status,rating=0,remove=false,onOptimistic})=>{
  const normalized=normalizeMovie(movie);
  const actionType=remove?'remove':(status==='rated'?'rate':status);
  const beforeCounts=assistantStateCounts();
  assistantDebug('library action before',{actionType,movieId:movie.tmdbId||movie.id||normalized.id||null,title:normalized.title,status,rating,remove,supabaseResult:lastSupabaseLibraryResult,beforeCounts});
  const previousMemory=getAssistantMemory();
  const next=getAssistantMemory();
  setAssistantMemory(setAssistantMovieStatus(next,movie,remove?'':status,rating));
  if(typeof onOptimistic==='function')onOptimistic();
  let savedOnline=false;
  try{
    savedOnline=remove?await deleteSupabaseLibraryMovie(movie):await upsertSupabaseLibraryMovie(movie,status,rating);
  }catch(error){
    console.warn('Kinora library mutation failed',error);
    lastSupabaseLibraryResult={ok:false,action:remove?'delete':'upsert',error:String(error.message||error)};
  }
  if(currentUserId()&&remove&&!savedOnline&&lastSupabaseLibraryResult?.error==='No matching Supabase row was deleted.'){
    savedOnline=true;
    lastSupabaseLibraryResult={...lastSupabaseLibraryResult,ok:true,error:null,idempotentDelete:true};
    assistantDebug('library delete treated as already removed',{title:normalized.title,status});
  }
  if(currentUserId()&&!savedOnline){
    setAssistantMemory(previousMemory);
    await loadSupabaseLibrary();
    if(typeof onOptimistic==='function')onOptimistic();
  }
  preserveAssistantWall();
  if(!assistantWallHasMovieCards())await recoverAssistantWallFromCandidates('library mutation');
  assistantDebug('library action after',{actionType,movieId:movie.tmdbId||movie.id||normalized.id||null,title:normalized.title,status,rating,remove,savedOnline,supabaseResult:lastSupabaseLibraryResult,beforeCounts,afterCounts:assistantStateCounts()});
  return !currentUserId()||savedOnline;
};
const openMovieDetails=async movie=>{
  const normalized=normalizeMovie(movie);
  if(normalized.id&&tmdbAvailable&&!normalized.imdbId){
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
  const save=document.createElement('button'); save.type='button'; save.textContent='SAVE';
  const watched=document.createElement('button'); watched.type='button'; watched.textContent='WATCH';
  const trailer=document.createElement('button'); trailer.type='button'; trailer.textContent='Trailer';
  const backToMatch=document.createElement('button'); backToMatch.type='button'; backToMatch.textContent='Back to Movie Match';
  const communityMatches=communityReviewsForMovie(normalized);
  const communityButton=document.createElement('button'); communityButton.type='button'; communityButton.textContent=communityMatches.length?'Community Reviews':'No community reviews yet';
  communityButton.className='community-review-action';
  communityButton.disabled=!communityMatches.length;
  communityButton.addEventListener('click',()=>{
    if(!communityMatches.length)return;
    trailerDialog.close();
    location.href=communityReviewUrlForMovie(normalized);
  });
  const ratingPanel=document.createElement('div'); ratingPanel.className='watched-rating-panel'; ratingPanel.hidden=true;
  const ratingQuestion=document.createElement('p'); ratingQuestion.textContent='How would you rate this movie?';
  const ratingScale=document.createElement('div'); ratingScale.className='watched-rating-scale';
  const ratingStatus=document.createElement('small'); ratingStatus.className='watched-rating-status';
  const skipRating=document.createElement('button'); skipRating.type='button'; skipRating.className='watched-rating-skip'; skipRating.textContent='Skip rating';
  const libraryStatus=document.createElement('p'); libraryStatus.className='movie-detail-library-status'; libraryStatus.setAttribute('role','status');
  Array.from({length:10},(_,index)=>index+1).forEach(score=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=String(score);
    button.setAttribute('aria-label',`Rate ${normalized.title} ${score} out of 10`);
    button.addEventListener('click',async()=>{
      if(!requireKinoraAuth())return;
      button.disabled=true;
      await mutateAssistantLibrary({movie,status:'rated',rating:score});
      sync();
      ratingStatus.textContent=`Your rating: ${score}/10`;
      libraryStatus.textContent=`Rating saved: ${score}/10.`;
      await rescoreAssistantWallSafely('rating saved');
      closeMovieDetailToMatch();
    });
    ratingScale.append(button);
  });
  skipRating.addEventListener('click',closeMovieDetailToMatch);
  ratingPanel.append(ratingQuestion,ratingScale,skipRating,ratingStatus);
  const sync=()=>{
    const memory=getAssistantMemory();
    const status=memory.items?.[normalized.title]?.status||'';
    const userRating=Number(memory.ratings?.[normalized.title]||0);
    save.classList.toggle('is-active',status==='saved');
    watched.classList.toggle('is-active',status==='watched'||status==='rated');
    save.disabled=saveBusy;
    watched.disabled=watchedBusy;
    save.textContent=status==='saved'?'SAVED':'SAVE';
    watched.textContent=status==='watched'||status==='rated'?'WATCHED':'WATCH';
    ratingPanel.hidden=!(status==='watched'||status==='rated');
    ratingScale.querySelectorAll('button').forEach((button,index)=>button.classList.toggle('is-active',index+1===userRating));
    ratingStatus.textContent=userRating?`Your rating: ${userRating}/10`:'';
    libraryStatus.textContent=status==='rated'&&userRating?`Saved, watched, and rated ${userRating}/10.`:
      status==='watched'?'Marked as watched. You can rate it below.':
      status==='saved'?'Saved to My Library.':
      'Not saved in My Library yet.';
  };
  let saveBusy=false;
  let watchedBusy=false;
  save.addEventListener('click',async()=>{
    if(!requireKinoraAuth())return;
    if(saveBusy)return;
    const next=getAssistantMemory();
    const currentStatus=next.items?.[normalized.title]?.status||'';
    const isActive=currentStatus==='saved';
    saveBusy=true;
    save.setAttribute('aria-busy','true');
    sync();
    const ok=await mutateAssistantLibrary({movie,status:'saved',remove:isActive,onOptimistic:sync});
    saveBusy=false;
    save.removeAttribute('aria-busy');
    sync();
    libraryStatus.textContent=ok?(isActive?'Removed from saved movies.':'Saved to My Library.'):'Could not update My Library. Please try again.';
    preserveAssistantWall();
    if(ok&&!isActive)closeMovieDetailToMatch();
  });
  watched.addEventListener('click',async()=>{
    if(!requireKinoraAuth())return;
    if(watchedBusy)return;
    const next=getAssistantMemory();
    const currentStatus=next.items?.[normalized.title]?.status||'';
    const isWatched=currentStatus==='watched'||currentStatus==='rated';
    watchedBusy=true;
    watched.setAttribute('aria-busy','true');
    sync();
    const ok=await mutateAssistantLibrary({movie,status:'watched',remove:isWatched,onOptimistic:sync});
    watchedBusy=false;
    watched.removeAttribute('aria-busy');
    sync();
    if(!ok){
      libraryStatus.textContent='Could not update watched status. Please try again.';
      return;
    }
    if(!isWatched){
      ratingPanel.hidden=false;
      ratingPanel.querySelector('button')?.focus({preventScroll:true});
    }else{
      ratingPanel.hidden=true;
      libraryStatus.textContent='Removed from watched movies.';
    }
  });
  trailer.addEventListener('click',()=>openTrailer(normalized));
  backToMatch.addEventListener('click',closeMovieDetailToMatch);
  actions.append(save,watched,trailer,communityButton,backToMatch); detail.append(title,meta,storyLabel,overview,ratings,libraryStatus,actions,ratingPanel); content.append(detail); message.textContent=''; sync(); trailerDialog.showModal();
};
const createAssistantCard=rawMovie=>{
  const movie=normalizeMovie(rawMovie);
  const poster=document.createElement('button'); poster.type='button'; poster.className='wall-poster'; poster.setAttribute('aria-label',`View details for ${movie.title}`);
  poster.dataset.title=movie.title;
  poster.dataset.year=movie.year;
  poster.dataset.genres=movie.genreIds.join(' ');
  poster.dataset.platforms=(rawMovie.platforms||[]).join(' ');
  poster.dataset.runtime=String(rawMovie.runtime||0);
  const image=document.createElement('img'); image.src=movie.poster||assistantPosterImage(movie.title); image.alt=`Poster for ${movie.title}`; image.loading='lazy'; image.decoding='async'; image.addEventListener('error',()=>{image.src=assistantPosterFallback(movie.title)},{once:true});
  const reason=rawMovie.assistantReason||'Recommended for your selected filters.';
  const personalReason=rawMovie.assistantPersonalReason?`<small class="assistant-personal-reason">${escapeHTML(rawMovie.assistantPersonalReason)}</small>`:'';
  const overlay=document.createElement('span'); overlay.className='wall-poster-overlay'; overlay.innerHTML=`<strong>${movie.title}</strong><small>${escapeHTML(reason)}</small>${personalReason}`;
  poster.append(image,overlay); poster.addEventListener('click',()=>openMovieDetails({...rawMovie,...movie}));
  return poster;
};
let assistantRenderRequest=0;
let assistantVariant=0;
let lastAssistantFilterSignature='';
const uniqueAssistantMovies=movies=>{
  const seen=new Set();
  return movies.filter(movie=>{
    const normalized=normalizeMovie(movie);
    const key=String(movie.tmdbId||movie.id||`${normalized.title}-${normalized.year}`).toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
};
const assistantResultId=movie=>{
  const normalized=normalizeMovie(movie);
  return String(movie.tmdbId||movie.id||`${normalized.title}-${normalized.year}`).toLowerCase();
};
const rememberAssistantRenderedResults=movies=>{
  const ids=movies.map(assistantResultId).filter(Boolean);
  previousResultIds=new Set(ids);
  recentlyShownIds=[
    ...ids,
    ...recentlyShownIds.filter(id=>!ids.includes(id))
  ].slice(0,40);
  window.previousResultIds=[...previousResultIds];
  window.recentlyShownIds=[...recentlyShownIds];
};
const weightedAssistantSelection=(rankedItems,visibleCount=5)=>{
  const highScorePool=rankedItems.slice(0,Math.min(100,Math.max(30,rankedItems.length)));
  const selected=[];
  const selectedIds=new Set();
  const scores=highScorePool.map(item=>Number(item.score)||0);
  const minScore=Math.min(...scores,0);
  const chooseOne=()=>{
    const available=highScorePool.filter(item=>!selectedIds.has(assistantResultId(item.movie)));
    if(!available.length)return null;
    const weights=available.map(item=>{
      const id=assistantResultId(item.movie);
      const recentIndex=recentlyShownIds.indexOf(id);
      const previousPenalty=previousResultIds.has(id)?22:0;
      const recentPenalty=recentIndex>=0?Math.max(0,12-recentIndex*.35):0;
      return Math.max(.25,(Number(item.score)||0)-minScore+1-previousPenalty-recentPenalty);
    });
    const total=weights.reduce((sum,weight)=>sum+weight,0);
    let cursor=Math.random()*total;
    for(let index=0;index<available.length;index+=1){
      cursor-=weights[index];
      if(cursor<=0)return available[index];
    }
    return available[available.length-1];
  };
  while(selected.length<visibleCount){
    const item=chooseOne();
    if(!item)break;
    selectedIds.add(assistantResultId(item.movie));
    selected.push(item);
  }
  return selected;
};
const getAssistantMoviePool=(candidates,answers,memory,{different=false}={})=>{
  const selectedPlatform=normalizePlatform(answers.platform);
  const {movies:strictSource,counts}=filterAssistantCandidates(candidates,answers,memory);
  const profile=computeAssistantTasteProfile(memory);
  const allowLibraryRepeats=false;
  const freshSource=strictSource.filter(movie=>!isAssistantLibraryExactMatch(movie,profile));
  const rankingSource=freshSource.length?freshSource:strictSource;
  const ranked=rankingSource
    .map(movie=>scoreAssistantMovieDetailed(movie,answers,memory,profile))
    .map(item=>{
      const id=assistantResultId(item.movie);
      const recentIndex=recentlyShownIds.indexOf(id);
      const recentPenalty=(previousResultIds.has(id)?30:0)+(recentIndex>=0?Math.max(0,16-recentIndex*.4):0);
      return {
        ...item,
        score:item.score-recentPenalty,
        movie:{
          ...item.movie,
          assistantScore:item.score-recentPenalty,
          assistantRecentPenalty:recentPenalty
        }
      };
    })
    .sort((a,b)=>b.score-a.score);
  const selected=weightedAssistantSelection(ranked,5).map(item=>item.movie);
  const pool=validateAssistantPool(selected,answers,memory);
  const bestScore=ranked[0]?.score||0;
  const fifthScore=ranked[4]?.score||0;
  assistantDebug('mood scoring',{
    countAfterMoodScoring:ranked.length,
    candidateSource:'movieCandidates',
    selectedPlatform,
    strictSourceCount:strictSource.length,
    libraryExactExcludedCount:strictSource.length-freshSource.length,
    libraryRepeatsAllowed:allowLibraryRepeats,
    highScorePoolSize:Math.min(100,Math.max(30,ranked.length)),
    previousResultIds:[...previousResultIds],
    recentlyShownIds:recentlyShownIds.slice(0,12),
    finalRenderedCount:pool.length,
    finalResults:pool.map(movie=>({
      title:normalizeMovie(movie).title,
      year:normalizeMovie(movie).year,
      genreIds:movieGenreIds(movie),
      genreNames:movieGenreIds(movie).map(id=>genreNames[id]||String(id)),
      passedGenreFilter:movieHasSelectedGenre(movie,answers),
      baseScore:Number(movie.assistantBaseScore||0).toFixed(2),
      personalizationScore:Number(movie.assistantPersonalizationScore||0).toFixed(2),
      recentPenalty:Number(movie.assistantRecentPenalty||0).toFixed(2),
      score:Number(movie.assistantScore||0).toFixed(2)
    })),
    tasteProfile:{
      favoriteGenreIds:profile.favoriteGenreIds.slice(0,8),
      favoriteMoodTags:profile.favoriteMoodTags.slice(0,8),
      favoriteDecades:profile.favoriteDecades.slice(0,6),
      dislikedGenreIds:profile.dislikedGenreIds.slice(0,8),
      watchedTmdbIds:[...profile.watchedTmdbIds].slice(0,12),
      savedTmdbIds:[...profile.savedTmdbIds].slice(0,12),
      ratedTmdbIds:[...profile.ratedTmdbIds].slice(0,12)
    },
    ...counts
  });
  return {pool:pool.slice(0,5),exactEnough:pool.length>=3&&bestScore>28&&fifthScore>18,ranked,strictCount:strictSource.length,counts,profile};
};
const renderPosterWall=(movies,{preserveOnEmpty=false,skipValidation=false}={})=>{
  const answers=getAssistantFilters();
  const memory=getAssistantMemory();
  const finalMovies=skipValidation?[...movies]:validateAssistantPool(movies,answers,memory);
  if(finalMovies.length!==movies.length){
    assistantDebug('final render guard removed results',{removed:movies.filter(movie=>!finalMovies.includes(movie)).map(movie=>({
      title:normalizeMovie(movie).title,
      genreIds:movieGenreIds(movie),
      year:normalizeMovie(movie).year
    })),selectedGenreId:selectedGenreId(answers)||null,selectedGenreName:genreNames[selectedGenreId(answers)]||'Any genre'});
  }
  if(!finalMovies.length){
    if(preserveOnEmpty&&lastVisibleAssistantRecommendations.length){
      assistantDebug('kept previous recommendations after empty guard',{candidateCount:movies.length,previousCount:lastVisibleAssistantRecommendations.length});
      scheduleAssistantWallRecovery('empty guard preserved previous wall');
      return false;
    }
    showAssistantWallEmpty('No exact matches found. Try changing one filter.');
    scheduleAssistantWallRecovery('render empty guard');
    assistantDebug('render empty after final guard',{candidateCount:movies.length,selectedGenreId:selectedGenreId(answers)||null,selectedGenreName:genreNames[selectedGenreId(answers)]||'Any genre'});
    return false;
  }
  assistantResults.innerHTML='';
  setCurrentRecommendations(finalMovies);
  lastVisibleAssistantRecommendations=[...finalMovies];
  rememberAssistantRenderedResults(finalMovies);
  saveLastVisibleAssistantWall(finalMovies);
  assistantDebug('rendered results',{results:finalMovies.map(movie=>({
    title:normalizeMovie(movie).title,
    selectedGenreId:selectedGenreId(answers)||null,
    selectedGenreName:genreNames[selectedGenreId(answers)]||'Any genre',
    poster_path:movie.poster_path||'',
    posterUrl:normalizeMovie(movie).poster,
    genres:movieGenreIds(movie),
    genreNames:movieGenreIds(movie).map(id=>genreNames[id]||String(id)),
    passedGenreFilter:movieHasSelectedGenre(movie,answers),
    year:normalizeMovie(movie).year
  }))});
  finalMovies.forEach(movie=>assistantResults.appendChild(createAssistantCard(movie)));
  return true;
};
const updateMovieWall=async ({scroll=false,different=false}={})=>{
  if(!assistantPanel||!assistantResults||!assistantReason)return;
  const requestId=++assistantRenderRequest;
  const answers=getAssistantFilters(); const memory=getAssistantMemory();
  const filterSignature=JSON.stringify(answers);
  const filtersChanged=filterSignature!==lastAssistantFilterSignature;
  assistantVariant++;
  lastAssistantFilterSignature=filterSignature;
  assistantPanel.hidden=false; assistantPanel.classList.add('is-visible');
  const cached=loadAssistantMovieCache();
  let staticSource=await loadAssistantStaticPackage();
  if(requestId!==assistantRenderRequest)return;
  let immediateSource=[];
  let activeSource='fallback';
  if(staticSource.length){
    immediateSource=mergeAssistantMovieSets(staticSource,cached);
    activeSource='static content package';
  }else if(cached.length>=5){
    immediateSource=cached;
    activeSource='cache';
  }else if(tmdbAvailable){
    immediateSource=[];
    activeSource='TMDB';
  }else{
    immediateSource=[];
    activeSource='fallback';
    assistantReason.textContent='Live movie data is not available. TMDB configuration is missing.';
  }
  assistantDataSourceLog(activeSource,{candidateCount:immediateSource.length,tmdbProxyAvailable:tmdbAvailable});
  let immediate;
  try{
    immediate=getAssistantMoviePool(immediateSource,answers,memory,{different});
  }catch(error){
    assistantDebug('initial scoring failed',{message:String(error),activeSource,...assistantStateCounts()});
    const fallbackMemory=defaultAssistantMemory();
    immediateSource=staticSource.length?staticSource:assistantFallback;
    activeSource=staticSource.length?'static content package':'fallback';
    immediate=getAssistantMoviePool(immediateSource,answers,fallbackMemory,{different});
  }
  updateAssistantPersonalizationNote(immediate.profile);
  assistantDebug('selected filters',{answers,dataSource:activeSource,cacheSize:cached.length,staticCount:staticSource.length,filtersChanged,different});
  if(immediate.pool.length){
    const rendered=renderPosterWall(immediate.pool);
    updateAssistantPersonalizationNote(immediate.profile);
    assistantReason.textContent=!rendered?
      'No exact matches found. Try changing one filter.':
      (immediate.exactEnough?assistantExplanation(answers,immediate.pool.map(normalizeMovie)):closestAssistantExplanation(answers,immediate.pool.map(normalizeMovie)));
  }else if(!assistantWallHasMovieCards()){
    assistantReason.textContent=immediate.strictCount===0?'No exact matches found. Try changing one filter.':(tmdbAvailable?'Building the movie cache. Recommendations will appear here shortly.':'Live movie data is not available. TMDB configuration is missing.');
  }else{
    assistantReason.textContent='Updating recommendations…';
  }
  try{
    const needsMoreCache=tmdbAvailable&&(cached.length<assistantCacheMinimum||immediate.strictCount<5);
    if(!needsMoreCache){
      if(!assistantWallHasMovieCards())await recoverAssistantWallFromCandidates('no background fetch needed');
      return;
    }
    if(!immediate.pool.length)assistantReason.textContent='Building exact genre matches…';
    if(selectedGenreId(answers)&&immediate.strictCount<5){
      const exactGenreCandidates=await fetchAssistantExactGenrePool(answers);
      if(requestId!==assistantRenderRequest)return;
      if(exactGenreCandidates.length){
        const mergedExact=mergeAssistantMovieSets(staticSource,cached,exactGenreCandidates);
        saveAssistantMovieCache(mergeAssistantMovieSets(loadAssistantMovieCache(),exactGenreCandidates));
        const exactPool=getAssistantMoviePool(mergedExact,answers,memory,{different});
        updateAssistantPersonalizationNote(exactPool.profile);
        if(exactPool.pool.length){
          const rendered=renderPosterWall(exactPool.pool);
          assistantReason.textContent=!rendered?
            'No exact matches found. Try changing one filter.':
            (exactPool.exactEnough?assistantExplanation(answers,exactPool.pool.map(normalizeMovie)):closestAssistantExplanation(answers,exactPool.pool.map(normalizeMovie)));
          if(exactPool.strictCount>=5)return;
        }
      }
    }
    if(!immediate.pool.length)assistantReason.textContent='Building a larger movie cache…';
    const candidates=await warmAssistantMovieCache({force:cached.length<assistantCacheMinimum});
    if(requestId!==assistantRenderRequest)return;
    const completeCandidates=staticSource.length?mergeAssistantMovieSets(staticSource,candidates):candidates;
    const {pool,exactEnough,profile}=getAssistantMoviePool(completeCandidates,answers,memory,{different});
    updateAssistantPersonalizationNote(profile);
    const rendered=pool.length?renderPosterWall(pool):false;
    assistantReason.textContent=pool.length&&rendered?(exactEnough?assistantExplanation(answers,pool.map(normalizeMovie)):closestAssistantExplanation(answers,pool.map(normalizeMovie))):'No exact matches found. Try changing one filter.';
    if(!rendered)await recoverAssistantWallFromCandidates('update movie wall');
  }catch(error){
    if(requestId!==assistantRenderRequest)return;
    assistantDataSourceLog('fallback',{reason:String(error)});
    const fallbackForCurrentFilters=assistantFallback;
    const {pool,profile}=getAssistantMoviePool(fallbackForCurrentFilters,answers,memory,{different});
    updateAssistantPersonalizationNote(profile);
    const rendered=pool.length?renderPosterWall(pool):false;
    assistantReason.textContent=pool.length&&rendered?closestAssistantExplanation(answers,pool.map(normalizeMovie)):'No exact matches found. Try changing one filter.';
    if(!rendered)await recoverAssistantWallFromCandidates('update movie wall error');
  }
  scheduleAssistantWallRecovery('update movie wall complete');
  if(scroll)assistantPanel.scrollIntoView({behavior:'smooth',block:'start'});
};
const renderAssistantRecommendations=updateMovieWall;
assistantForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  updateMovieWall({scroll:true,different:false});
});
assistantRefreshButton?.addEventListener('click',()=>updateMovieWall({different:true,scroll:false}));
document.querySelector('[data-clear-decision-memory]')?.addEventListener('click',()=>{clearAssistantLibraryMemory();});
assistantLibrarySearch?.addEventListener('input',updateAssistantMemory);
if(assistantResults&&window.MutationObserver){
  new MutationObserver(()=>{
    if(!assistantPanel||assistantPanel.hidden||assistantWallHasMovieCards())return;
    const hasEmptyMessage=Boolean(assistantResults.querySelector('.assistant-wall-empty'));
    if(!hasEmptyMessage)scheduleAssistantWallRecovery('poster grid mutation');
  }).observe(assistantResults,{childList:true});
}
updateAssistantMemory();
setTimeout(()=>{
  assistantDebug('page load',{
    supabaseConfigured:Boolean(supabaseClient),
    authUserExists:Boolean(currentUserId()),
    movieDataSource:window.movieMatchActiveDataSource||'not loaded yet',
    movieCandidatesCount:movieCandidates.length||loadAssistantMovieCache().length||assistantFallback.length
  });
},0);

const communityForm=document.querySelector('[data-community-form]');
const communityFormMessage=communityForm?.querySelector('[data-community-message]');
const communityMovieInput=communityForm?.querySelector('[data-community-movie-search]');
const communityMovieSuggestions=communityForm?.querySelector('[data-community-movie-suggestions]');
const communityPosterPreview=communityForm?.querySelector('[data-community-poster-preview]');
const communityTmdbIdInput=communityForm?.querySelector('[data-community-tmdb-id]');
const communityReleaseYearInput=communityForm?.querySelector('[data-community-release-year]');
const communityPosterPathInput=communityForm?.querySelector('[data-community-poster-path]');
const communityPosterUrlInput=communityForm?.querySelector('[data-community-poster-url]');
const communityWatchPlatformSelect=communityForm?.querySelector('[data-watch-platform]');
const communityCinemaNameField=communityForm?.querySelector('[data-cinema-name-field]');
const communityStarRating=communityForm?.querySelector('[data-community-star-rating]');
const memoryWall=document.querySelector('.memory-wall');
const communityArchive=document.querySelector('.community-archive');
const communityDialog=document.querySelector('[data-community-dialog]');
const communityDialogContent=document.querySelector('[data-community-dialog-content]');
const communityCurrent=document.querySelector('[data-community-current]');
const communityTotal=document.querySelector('[data-community-total]');
const communityReviewSearch=document.querySelector('[data-community-review-search]');
const communityEmpty=document.querySelector('[data-community-empty]');
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
const communityMemoryFromSupabase=row=>({
  id:row.id,
  userId:row.user_id,
  movie:row.movie_title,
  tmdbId:row.tmdb_id?String(row.tmdb_id):'',
  releaseYear:row.release_year?String(row.release_year):'',
  posterPath:row.poster_path||'',
  poster:row.poster_url||'',
  posterUrl:row.poster_url||'',
  rating:String(row.rating||''),
  name:row.display_name||row.username||'Kinora member',
  'review-title':row.review_title,
  experience:row.review_text,
  preview:String(row.review_text||'').slice(0,120),
  cinema:row.cinema_name||'',
  watchPlatform:row.watch_platform||row.cinema_name||'Cinema',
  'feeling-before':row.feeling_before||'-',
  'feeling-after':row.feeling_after||'-',
  recommend:row.recommend||'Maybe',
  recordedAt:row.created_at,
  isSupabase:true,
  isLocal:row.user_id===currentUserId()
});
const loadSupabaseCommunityReviews=async ()=>{
  if(!supabaseClient||!memoryWall)return;
  const {data,error}=await supabaseClient.from('community_reviews').select('*').order('created_at',{ascending:false}).limit(50);
  if(error){console.warn('Community reviews load failed',error);return;}
  memoryWall.querySelectorAll('.memory-case[data-supabase-review="true"]').forEach(card=>card.remove());
  (data||[]).reverse().forEach(row=>addMemoryCard(communityMemoryFromSupabase(row)));
  applyCommunityReviewSearch();
};
const saveSupabaseCommunityReview=async memory=>{
  if(!supabaseClient||!currentUserId())return null;
  const payload={
    user_id:currentUserId(),
    username:kinoraProfile?.username||null,
    display_name:kinoraProfile?.display_name||kinoraProfile?.username||kinoraSession?.user?.email||null,
    tmdb_id:memory.tmdbId?Number(memory.tmdbId):null,
    movie_title:memory.movie,
    release_year:memory.releaseYear?Number(memory.releaseYear):null,
    poster_url:memory.posterUrl||memory.poster||null,
    poster_path:memory.posterPath||null,
    rating:Number(String(memory.rating||'').match(/\d+/)?.[0]||memory.rating||0),
    review_title:memory['review-title']||'Community review',
    review_text:memory.experience||'',
    watch_platform:memory.watch_platform||memory.watchPlatform||null,
    cinema_name:memory.cinema||null,
    feeling_before:memory['feeling-before']||null,
    feeling_after:memory['feeling-after']||null,
    recommend:memory.recommend||null
  };
  const {data,error}=await supabaseClient.from('community_reviews').insert(payload).select('*').single();
  if(error){console.warn('Community review save failed',error);return null;}
  return communityMemoryFromSupabase(data);
};
const deleteSupabaseCommunityReview=async reviewId=>{
  if(!supabaseClient||!currentUserId()||!reviewId)return false;
  const {error}=await supabaseClient.from('community_reviews').delete().eq('id',reviewId).eq('user_id',currentUserId());
  if(error){console.warn('Community review delete failed',error);return false;}
  return true;
};
const normalizeCommunityTitle=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const communityPosterFallback=title=>posterFallback(title||'Community Review');
const communityPosterFromPath=(posterPath,title)=>posterPath?`${imageBase}${posterPath}`:communityPosterFallback(title);
const isCommunityPlaceholderPoster=poster=>{
  const value=String(poster||'');
  return !value||value.startsWith('data:image/svg+xml')||value.includes('movie-poster-fallback.svg')||/\/images\/journal-[^/]+\.svg/.test(value);
};
const fetchCommunityMovieMatch=async title=>{
  if(!tmdbAvailable||!title)return null;
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
let communityMovieSearchRevision=0;
let communitySuggestionIndex=-1;
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
  communitySuggestionIndex=-1;
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
  movies.forEach((movie,index)=>{
    const option=document.createElement('button');
    option.type='button';
    option.className='movie-suggestion';
    option.setAttribute('role','option');
    option.setAttribute('aria-selected','false');
    option.dataset.tmdbId=movie.tmdbId;
    option.dataset.suggestionIndex=String(index);
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
const setCommunitySuggestionIndex=index=>{
  const options=[...(communityMovieSuggestions?.querySelectorAll('.movie-suggestion')||[])];
  if(!options.length){communitySuggestionIndex=-1;return;}
  communitySuggestionIndex=(index+options.length)%options.length;
  options.forEach((option,optionIndex)=>{
    const active=optionIndex===communitySuggestionIndex;
    option.classList.toggle('is-active',active);
    option.setAttribute('aria-selected',String(active));
  });
  options[communitySuggestionIndex]?.scrollIntoView({block:'nearest'});
};
const searchCommunityMovies=query=>{
  const revision=++communityMovieSearchRevision;
  clearTimeout(communityMovieSearchTimer);
  communityMovieSearchController?.abort();
  if(!tmdbAvailable||query.length<2){hideCommunityMovieSuggestions();return;}
  communityMovieSearchTimer=setTimeout(async()=>{
    communityMovieSearchController=new AbortController();
    if(communityFormMessage)communityFormMessage.textContent='Searching the movie catalogue…';
    try{
      const data=normalizeTmdbListResponse(await tmdb('/search/movie',{query,include_adult:'false',page:'1'},communityMovieSearchController.signal),'Community search');
      if(revision!==communityMovieSearchRevision||communityMovieInput?.value.trim()!==query)return;
      const movies=(Array.isArray(data.results)?data.results:[]).slice(0,6).map(normalizeCommunityMovieResult);
      renderCommunityMovieSuggestions(movies);
      if(communityFormMessage)communityFormMessage.textContent=movies.length?'':'No matching movies found.';
    }catch(error){
      if(error.name!=='AbortError'&&revision===communityMovieSearchRevision){
        console.warn('Community TMDB movie search failed',error);
        hideCommunityMovieSuggestions();
        if(communityFormMessage)communityFormMessage.textContent='Movie search is temporarily unavailable. Please try again.';
      }
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
          <div><dt>Watched on</dt><dd>${escapeHTML(data.watchPlatform||data.cinema||'Cinema')}</dd></div>
          ${data.cinema?`<div><dt>Cinema</dt><dd>${escapeHTML(data.cinema)}</dd></div>`:''}
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
  card.dataset.reviewId=reviewId;card.dataset.localReview=isLocal?'true':'false';card.dataset.supabaseReview=memory.isSupabase?'true':'false';card.dataset.movie=memory.movie;card.dataset.tmdbId=memory.tmdbId||'';card.dataset.releaseYear=memory.releaseYear||'';card.dataset.posterPath=memory.posterPath||'';card.dataset.reviewTitle=memory['review-title']||'Community review';card.dataset.rating=String(score);card.dataset.author=memory.name||'Anonymous';card.dataset.date=recordedAt;card.dataset.watchPlatform=memory.watchPlatform||memory.watch_platform||memory.cinema||'Cinema';card.dataset.cinema=memory.cinema||'';card.dataset.poster=poster;card.dataset.experience=memory.experience||'A cinema memory worth keeping.';card.dataset.preview=memory.preview||memory.experience||'A cinema memory worth keeping.';card.dataset.before=memory['feeling-before']||'-';card.dataset.after=memory['feeling-after']||'-';card.dataset.recommend=memory.recommend||'Maybe';
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
  card.append(image,spine);memoryWall.append(card);applyCommunityReviewSearch();updateCommunityDeck(communityCards.length-1);updateGraceControls();
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
  if(!tmdbAvailable||!memoryWall)return;
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
const allCommunityCards=()=>memoryWall?[...memoryWall.querySelectorAll('.memory-case')]:[];
const visibleCommunityCards=()=>allCommunityCards().filter(card=>!card.hidden);
const communityCaseMatchesSearch=(card,query)=>{
  if(!query)return true;
  return [card.dataset.movie,card.dataset.author,card.dataset.reviewTitle].some(value=>String(value||'').toLowerCase().includes(query));
};
const updateCommunityDeck=index=>{
  if(!memoryWall)return;
  communityCards=visibleCommunityCards();
  if(!communityCards.length){
    allCommunityCards().forEach(card=>{card.dataset.state='hidden';card.dataset.visible='false';card.tabIndex=-1;});
    if(communityCurrent)communityCurrent.textContent='00';
    if(communityTotal)communityTotal.textContent='00';
    if(communityEmpty)communityEmpty.hidden=false;
    return;
  }
  if(communityEmpty)communityEmpty.hidden=true;
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
const applyCommunityReviewSearch=()=>{
  const query=(communityReviewSearch?.value||'').trim().toLowerCase();
  allCommunityCards().forEach(card=>{card.hidden=!communityCaseMatchesSearch(card,query);});
  updateCommunityDeck(0);
};
const applyCommunityReviewDeepLink=()=>{
  if(!communityReviewSearch)return;
  const reviewQuery=new URLSearchParams(location.search).get('review');
  if(!reviewQuery)return;
  communityReviewSearch.value=reviewQuery;
  applyCommunityReviewSearch();
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
  if(communityAnimating)return;
  if(Math.sign(communityWheelDelta)&&Math.sign(communityWheelDelta)!==direction)communityWheelDelta=0;
  communityWheelDelta+=delta;
  communityWheelDelta=Math.max(-communityWheelThreshold,Math.min(communityWheelThreshold,communityWheelDelta));
  flushCommunityWheel();
},{passive:true});
memoryWall?.addEventListener('click',async event=>{
  const deleteButton=event.target.closest('[data-delete-review]');
  if(deleteButton){
    event.preventDefault();
    event.stopPropagation();
    const reviewId=deleteButton.dataset.deleteReview;
    const card=deleteButton.closest('.memory-case');
    if(card?.dataset.supabaseReview==='true'){
      if(!await deleteSupabaseCommunityReview(reviewId))return;
    }else{
      persistCommunityMemories(savedCommunityMemories().filter(memory=>communityReviewId(memory)!==reviewId));
    }
    const deletedIndex=communityCards.indexOf(card);
    card?.remove();
    applyCommunityReviewSearch();
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
communityReviewSearch?.addEventListener('input',applyCommunityReviewSearch);
const setCommunityStarRating=value=>{
  const score=Math.max(0,Math.min(5,Number(value)||0));
  if(!communityStarRating)return;
  const input=communityStarRating.querySelector('input[name="rating"]');
  if(input)input.value=score?String(score):'';
  communityStarRating.querySelectorAll('[data-rating-value]').forEach(button=>{
    const active=Number(button.dataset.ratingValue)<=score;
    button.classList.toggle('is-active',active);
    button.textContent=active?'★':'☆';
    button.setAttribute('aria-pressed',String(Number(button.dataset.ratingValue)===score));
  });
};
communityStarRating?.addEventListener('click',event=>{
  const button=event.target.closest('[data-rating-value]');
  if(!button)return;
  setCommunityStarRating(button.dataset.ratingValue);
});
const syncCommunityWatchPlatform=()=>{
  const isCinema=communityWatchPlatformSelect?.value==='Cinema';
  if(communityCinemaNameField)communityCinemaNameField.hidden=!isCinema;
};
communityWatchPlatformSelect?.addEventListener('change',syncCommunityWatchPlatform);
syncCommunityWatchPlatform();
communityForm?.addEventListener('wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
  event.preventDefault();
  const distance=event.deltaMode===1?event.deltaY*16:event.deltaMode===2?event.deltaY*innerHeight:event.deltaY;
  communityForm.scrollTop+=distance;
  window.scrollBy({top:distance,left:0,behavior:'auto'});
},{passive:false});
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
  if((event.key==='ArrowDown'||event.key==='ArrowUp')&&communityMovieSuggestions&&!communityMovieSuggestions.hidden){
    event.preventDefault();
    setCommunitySuggestionIndex(communitySuggestionIndex+(event.key==='ArrowDown'?1:-1));
  }
  if(event.key==='Enter'&&communityMovieSuggestions&&!communityMovieSuggestions.hidden){
    const suggestions=[...communityMovieSuggestions.querySelectorAll('.movie-suggestion')];
    const selectedSuggestion=suggestions[communitySuggestionIndex]||suggestions[0];
    if(selectedSuggestion){
      event.preventDefault();
      selectedSuggestion.click();
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
applyCommunityReviewSearch();
applyCommunityReviewDeepLink();
updateGraceControls();
upgradeSavedCommunityPosters();
communityForm?.addEventListener('submit',async event=>{
  event.preventDefault(); const message=communityForm.querySelector('[data-community-message]'); message.textContent='Saving your cinema memory…';
  if(!requireKinoraAuth('Log in to save this to your Kinora library.')){message.textContent='Log in to save this to your Kinora library.';return;}
  const formData=new FormData(communityForm);
  const memory=Object.fromEntries(formData.entries());
  if(!Number(memory.rating)){
    message.textContent='Please choose a 1–5 star rating.';
    return;
  }
  memory.name=authDisplayName();
  formData.set('name',memory.name);
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
  memory.watchPlatform=memory.watch_platform||memory.watchPlatform||'';
  if(memory.watchPlatform!=='Cinema')memory.cinema='';
  const supabaseMemory=await saveSupabaseCommunityReview(memory);
  if(!supabaseMemory){message.textContent='The review could not be saved online. Please try again.';return;}
  addMemoryCard({...supabaseMemory,isLocal:true}); communityForm.reset(); setCommunityStarRating(0); syncCommunityWatchPlatform(); fillCommunityReviewName(); clearCommunityMovieSelection(); hideCommunityMovieSuggestions(); message.textContent='Your review has been added. You can delete it for 1 minute.';
});
const refreshKinoraPersonalData=async()=>{
  if(!currentUserId())return;
  await Promise.all([loadSupabaseLibrary(),loadSupabaseReminders(),loadSupabaseUpcomingPreferences(),loadSupabaseCommunityReviews()]);
};
function resetPersonalDataForAuthTransition(previousUserId,nextUserId){
  if(previousUserId===nextUserId&&nextUserId)return;
  authenticatedAssistantMemory=defaultAssistantMemory();
  authenticatedRadarStores.watchlist=[];
  authenticatedRadarStores.hidden=[];
  kinoraLibraryReady=false;
  syncUserLibraryState();
  updateAssistantMemory();
  renderRadarLists();
  if(upcomingState.catalogueMovies.length)renderUpcomingResults(filterRadarMovies(upcomingState.catalogueMovies));
}
document.addEventListener('kinora-auth-change',refreshKinoraPersonalData);
if(comingResults){
  setupUpcomingDebugPanel();
  renderRadarLists();
  Promise.resolve().then(async()=>{
    await kinoraAuthReady;
    if(currentUserId())await Promise.all([loadSupabaseReminders(),loadSupabaseUpcomingPreferences()]);
    await startUpcomingInitialLoad();
    if(currentUserId())Promise.all([loadSupabaseLibrary(),loadSupabaseCommunityReviews()]).catch(error=>console.warn('Personal data background load failed',error));
  }).catch(error=>{
    console.error('Upcoming initialization failed',error);
    upcomingState.isLoading=false;
    if(comingStatus)comingStatus.textContent='The upcoming catalogue could not be initialized. Please refresh and try again.';
    setUpcomingLoadMoreVisible(false);
    updateUpcomingDebugPanel();
  });
}
