-- Run once in Supabase SQL Editor for BingoX (fftzctuxxntipjbepvwr)
alter table public.profiles
  add column if not exists has_double_js boolean not null default false;

comment on column public.profiles.has_double_js is 'Permanent 2x JS from Google Play double_js IAP';
