-- Invoice Manager — initial schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run

-- Invoices table
create table if not exists public.invoices (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Clients table
create table if not exists public.clients (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Business profiles table
create table if not exists public.business_profiles (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Settings table (one row per user)
create table if not exists public.settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security on all tables
alter table public.invoices enable row level security;
alter table public.clients enable row level security;
alter table public.business_profiles enable row level security;
alter table public.settings enable row level security;

-- RLS Policies: each user can only access their own rows
create policy "own invoices"
  on public.invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own clients"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own business_profiles"
  on public.business_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own settings"
  on public.settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
