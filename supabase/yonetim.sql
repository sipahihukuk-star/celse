-- Yönetim paneli: yöneticiler, sunucuda saklanan dava dosyaları ve yapay zekâ denetim raporları.
-- Supabase > SQL Editor'de bir kez çalıştırılır (schema.sql'den sonra). Tekrar çalıştırmak zararsızdır.
-- Sonra kendinizi yönetici yapın (e-posta, oyuna üye olurken kullandığınız adres):
--   insert into public.yoneticiler (kullanici_id) select id from auth.users where email = 'E-POSTA';

create table if not exists public.yoneticiler (
  kullanici_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.yoneticiler enable row level security;
drop policy if exists "kendini görür" on public.yoneticiler;
create policy "kendini görür" on public.yoneticiler for select using (auth.uid() = kullanici_id);

create or replace function public.yonetici_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.yoneticiler where kullanici_id = auth.uid());
$$;

-- Panelde düzeltilen ya da üretilen dosyalar. Yayındakileri bütün oyuncular görür; aynı kimlikli yerleşik dosyanın yerine geçer.
create table if not exists public.dosyalar (
  id text primary key,
  veri jsonb not null,
  durum text not null check (durum in ('taslak', 'yayinda')),
  kaynak text not null default 'panel',
  guncelleme timestamptz not null default now(),
  guncelleyen uuid references auth.users (id) on delete set null
);
alter table public.dosyalar enable row level security;
drop policy if exists "yayındakileri herkes görür" on public.dosyalar;
create policy "yayındakileri herkes görür" on public.dosyalar for select using (durum = 'yayinda' or public.yonetici_mi());
drop policy if exists "yönetici yazar" on public.dosyalar;
create policy "yönetici yazar" on public.dosyalar for all using (public.yonetici_mi()) with check (public.yonetici_mi());

-- Yapay zekâ denetim raporları (dosya başına son rapor); yalnızca yöneticiler görür.
create table if not exists public.denetimler (
  dava_id text primary key,
  rapor jsonb not null,
  tarih timestamptz not null default now()
);
alter table public.denetimler enable row level security;
drop policy if exists "yönetici denetimleri" on public.denetimler;
create policy "yönetici denetimleri" on public.denetimler for all using (public.yonetici_mi()) with check (public.yonetici_mi());
