-- Celse · 3. kurulum: yöneticinin oyunculara ücretsiz erişim vermesi ve internet üzerinden karşılıklı oyun.
-- Supabase > SQL Editor'de bir kez çalıştırılır (schema.sql ve yonetim.sql'den sonra). Tekrar çalıştırmak zararsızdır.

/* ---------- Yönetici: oyuncuları görme ve ücretsiz erişim ---------- */

drop policy if exists "yönetici profilleri görür" on public.profiller;
create policy "yönetici profilleri görür" on public.profiller for select using (public.yonetici_mi());

drop policy if exists "yönetici abonelikleri yönetir" on public.abonelikler;
create policy "yönetici abonelikleri yönetir" on public.abonelikler for all
  using (public.yonetici_mi()) with check (public.yonetici_mi() and kaynak = 'manuel');

/* ---------- İnternet üzerinden karşılıklı oyun ---------- */

create table if not exists public.eslesmeler (
  id uuid primary key default gen_random_uuid(),
  kod text unique not null,
  dava_id text not null,
  dil text not null default 'tr',
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'oynaniyor', 'bitti', 'iptal')),
  acik boolean not null default true,
  kurucu uuid not null references auth.users (id) on delete cascade,
  p1 uuid references auth.users (id) on delete set null,
  p2 uuid references auth.users (id) on delete set null,
  p1_ad text,
  p2_ad text,
  hamleler jsonb not null default '[]'::jsonb,
  son1 text,
  son2 text,
  karar jsonb,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index if not exists eslesmeler_bekleyen on public.eslesmeler (durum, acik, olusturma desc);

alter table public.eslesmeler enable row level security;
drop policy if exists "eşleşme görünürlüğü" on public.eslesmeler;
create policy "eşleşme görünürlüğü" on public.eslesmeler for select to authenticated
  using (auth.uid() = kurucu or auth.uid() = p1 or auth.uid() = p2 or (durum = 'bekliyor' and acik));
drop policy if exists "eşleşme kurma" on public.eslesmeler;
create policy "eşleşme kurma" on public.eslesmeler for insert to authenticated
  with check (kurucu = auth.uid() and (p1 = auth.uid() or p2 = auth.uid()) and durum = 'bekliyor' and jsonb_array_length(hamleler) = 0);
-- Eşleşme satırları doğrudan güncellenmez; aşağıdaki işlevler kuralları denetleyerek yazar.

create or replace function public.eslesmeye_katil(k text, ad text) returns public.eslesmeler
language plpgsql security definer set search_path = public as $$
declare m public.eslesmeler;
begin
  select * into m from public.eslesmeler where kod = upper(trim(k)) for update;
  if not found then raise exception 'Bu kodla bir davet bulunamadı'; end if;
  if m.durum <> 'bekliyor' then raise exception 'Bu davet artık açık değil'; end if;
  if auth.uid() is null then raise exception 'Önce giriş yapın'; end if;
  if auth.uid() = m.kurucu then raise exception 'Kendi davetinize katılamazsınız'; end if;
  if m.p1 is null then
    update public.eslesmeler set p1 = auth.uid(), p1_ad = left(ad, 40), durum = 'oynaniyor', guncelleme = now() where id = m.id returning * into m;
  else
    update public.eslesmeler set p2 = auth.uid(), p2_ad = left(ad, 40), durum = 'oynaniyor', guncelleme = now() where id = m.id returning * into m;
  end if;
  return m;
end; $$;

create or replace function public.hamle_ekle(m uuid, n int, h jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e public.eslesmeler;
begin
  select * into e from public.eslesmeler where id = m for update;
  if not found or auth.uid() is null or (auth.uid() <> coalesce(e.p1, '00000000-0000-0000-0000-000000000000') and auth.uid() <> coalesce(e.p2, '00000000-0000-0000-0000-000000000000')) then raise exception 'Yetki yok'; end if;
  if e.durum <> 'oynaniyor' then raise exception 'Eşleşme oynanmıyor'; end if;
  -- Hamleler sırayla yazılır; aynı hamle iki kez gelirse yok sayılır.
  if jsonb_array_length(e.hamleler) <> n then return; end if;
  update public.eslesmeler set hamleler = hamleler || jsonb_build_array(h), guncelleme = now() where id = m;
end; $$;

create or replace function public.son_soz_yaz(m uuid, metin text) returns void
language plpgsql security definer set search_path = public as $$
declare e public.eslesmeler;
begin
  select * into e from public.eslesmeler where id = m for update;
  if not found then raise exception 'Eşleşme yok'; end if;
  if auth.uid() = e.p1 then update public.eslesmeler set son1 = left(metin, 2500), guncelleme = now() where id = m;
  elsif auth.uid() = e.p2 then update public.eslesmeler set son2 = left(metin, 2500), guncelleme = now() where id = m;
  else raise exception 'Yetki yok'; end if;
end; $$;

create or replace function public.karar_yaz(m uuid, k jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e public.eslesmeler;
begin
  select * into e from public.eslesmeler where id = m for update;
  if not found or (auth.uid() <> coalesce(e.p1, '00000000-0000-0000-0000-000000000000') and auth.uid() <> coalesce(e.p2, '00000000-0000-0000-0000-000000000000')) then raise exception 'Yetki yok'; end if;
  if e.karar is not null then return; end if;
  update public.eslesmeler set karar = k, durum = 'bitti', guncelleme = now() where id = m;
end; $$;

create or replace function public.eslesme_birak(m uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e public.eslesmeler;
begin
  select * into e from public.eslesmeler where id = m for update;
  if not found or (auth.uid() <> e.kurucu and auth.uid() <> coalesce(e.p1, '00000000-0000-0000-0000-000000000000') and auth.uid() <> coalesce(e.p2, '00000000-0000-0000-0000-000000000000')) then raise exception 'Yetki yok'; end if;
  if e.durum in ('bekliyor', 'oynaniyor') then update public.eslesmeler set durum = 'iptal', guncelleme = now() where id = m; end if;
end; $$;

/* ---------- Dosya çevirileri (tahkim dosyaları; EN, ES, FR, DE) ---------- */

create table if not exists public.ceviriler (
  dava_id text not null,
  dil text not null check (dil in ('en', 'es', 'fr', 'de')),
  veri jsonb not null,
  guncelleme timestamptz not null default now(),
  primary key (dava_id, dil)
);
alter table public.ceviriler enable row level security;
drop policy if exists "çevirileri herkes okur" on public.ceviriler;
create policy "çevirileri herkes okur" on public.ceviriler for select using (true);
drop policy if exists "çevirileri yönetici yazar" on public.ceviriler;
create policy "çevirileri yönetici yazar" on public.ceviriler for all using (public.yonetici_mi()) with check (public.yonetici_mi());
