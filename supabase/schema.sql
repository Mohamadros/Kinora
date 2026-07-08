-- Kinora Supabase schema
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id bigint,
  title text not null,
  release_year int,
  poster_url text,
  poster_path text,
  status text not null check (status in ('saved','watched','rated')),
  rating numeric check (rating is null or (rating >= 0 and rating <= 10)),
  genres int[] default '{}',
  genre_names text[] default '{}',
  mood_tags text[] default '{}',
  runtime int,
  overview text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id),
  unique (user_id, title, release_year)
);

create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  display_name text,
  tmdb_id bigint,
  movie_title text not null,
  release_year int,
  poster_url text,
  poster_path text,
  rating int not null check (rating between 1 and 5),
  review_title text not null,
  review_text text not null,
  cinema_name text,
  feeling_before text,
  feeling_after text,
  recommend text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upcoming_movie_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id bigint,
  movie_title text not null,
  poster_url text,
  poster_path text,
  release_date date,
  reminder_status text not null default 'active' check (reminder_status in ('active','cancelled','sent')),
  reminder_sent boolean not null default false,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tmdb_id),
  unique (user_id, movie_title, release_date)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'username',''),
    nullif(new.raw_user_meta_data->>'display_name','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.movie_library enable row level security;
alter table public.community_reviews enable row level security;
alter table public.upcoming_movie_reminders enable row level security;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
on public.profiles for select
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users read own library" on public.movie_library;
create policy "Users read own library"
on public.movie_library for select
using (auth.uid() = user_id);

drop policy if exists "Users create own library" on public.movie_library;
create policy "Users create own library"
on public.movie_library for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own library" on public.movie_library;
create policy "Users update own library"
on public.movie_library for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own library" on public.movie_library;
create policy "Users delete own library"
on public.movie_library for delete
using (auth.uid() = user_id);

drop policy if exists "Public reviews are readable" on public.community_reviews;
create policy "Public reviews are readable"
on public.community_reviews for select
using (true);

drop policy if exists "Users create own reviews" on public.community_reviews;
create policy "Users create own reviews"
on public.community_reviews for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own reviews" on public.community_reviews;
create policy "Users update own reviews"
on public.community_reviews for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own reviews" on public.community_reviews;
create policy "Users delete own reviews"
on public.community_reviews for delete
using (auth.uid() = user_id);

drop policy if exists "Users read own reminders" on public.upcoming_movie_reminders;
create policy "Users read own reminders"
on public.upcoming_movie_reminders for select
using (auth.uid() = user_id);

drop policy if exists "Users create own reminders" on public.upcoming_movie_reminders;
create policy "Users create own reminders"
on public.upcoming_movie_reminders for insert
with check (auth.uid() = user_id);

drop policy if exists "Users update own reminders" on public.upcoming_movie_reminders;
create policy "Users update own reminders"
on public.upcoming_movie_reminders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own reminders" on public.upcoming_movie_reminders;
create policy "Users delete own reminders"
on public.upcoming_movie_reminders for delete
using (auth.uid() = user_id);

create index if not exists movie_library_user_status_idx on public.movie_library(user_id, status);
create index if not exists community_reviews_movie_idx on public.community_reviews(tmdb_id, movie_title, release_year);
create index if not exists reminders_due_idx on public.upcoming_movie_reminders(reminder_status, reminder_sent, release_date);
