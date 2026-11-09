-- Celse · 21. kurulum: Mevzuat arşivi (yürürlükteki ve mülga bütün kanunlar, madde madde) ve resmî arama önbelleği.
-- - mevzuat_kanun: kanun künyesi (no, ad, yürürlük durumu, resmî kaynak bağlantısı, metin özeti).
-- - mevzuat_madde: her madde ayrı satır; Türkçe tam metin araması için dizin (madde başlığı + metin).
--   Metinler Adalet Bakanlığı mevzuat servisinden günlük güncellenen açık veri deposundan (acik-mevzuat) danisma ile yüklenir;
--   yükleme ve güncelleme yalnız yönetici panelinden yapılır. Okuma: oturum açmış kullanıcılar.
-- - hukuk_onbellek: resmî karar ve mevzuat aramalarının sonuçları ve belge metinleri (sunucu kullanır, kimse doğrudan okumaz).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create table if not exists public.mevzuat_kanun (
  slug text primary key,
  no text not null,
  ad text not null,
  durum text not null default 'yururlukte',
  kabul date,
  rg_sayi text,
  kaynak_url text,
  mevzuat_id text,
  sha text,
  madde_sayisi int not null default 0,
  guncelleme timestamptz not null default now()
);
create index if not exists mevzuat_kanun_no on public.mevzuat_kanun (no);

create table if not exists public.mevzuat_madde (
  id bigserial primary key,
  slug text not null references public.mevzuat_kanun (slug) on delete cascade,
  sira int not null,
  madde text not null,
  baslik text,
  metin text not null,
  ara tsvector generated always as (to_tsvector('turkish', coalesce(baslik, '') || ' ' || metin)) stored
);
create index if not exists mevzuat_madde_slug on public.mevzuat_madde (slug, sira);
create index if not exists mevzuat_madde_ara on public.mevzuat_madde using gin (ara);

alter table public.mevzuat_kanun enable row level security;
alter table public.mevzuat_madde enable row level security;
drop policy if exists mevzuat_kanun_oku on public.mevzuat_kanun;
create policy mevzuat_kanun_oku on public.mevzuat_kanun for select to authenticated using (true);
drop policy if exists mevzuat_madde_oku on public.mevzuat_madde;
create policy mevzuat_madde_oku on public.mevzuat_madde for select to authenticated using (true);

create table if not exists public.hukuk_onbellek (
  anahtar text primary key,
  veri jsonb not null,
  tarih timestamptz not null default now()
);
alter table public.hukuk_onbellek enable row level security;

-- Madde araması: sözcüklerle (Türkçe kök), en ilgili maddeler. Yalnız yürürlüktekiler ya da hepsi.
create or replace function public.mevzuat_ara(p_soz text, p_sinir int default 20, p_mulga boolean default false)
returns table (slug text, no text, ad text, durum text, madde text, baslik text, metin text, puan real)
language sql stable security definer set search_path = public as $$
  with q as (select websearch_to_tsquery('turkish', p_soz) as t)
  select m.slug, k.no, k.ad, k.durum, m.madde, m.baslik, left(m.metin, 1500), ts_rank(m.ara, q.t)
  from public.mevzuat_madde m join public.mevzuat_kanun k on k.slug = m.slug, q
  where m.ara @@ q.t and (p_mulga or k.durum = 'yururlukte')
  order by ts_rank(m.ara, q.t) desc, k.durum desc
  limit least(greatest(p_sinir, 1), 50)
$$;
grant execute on function public.mevzuat_ara(text, int, boolean) to authenticated;

-- Belirli madde: kanun no ve madde ("6100", "281" ya da "Geçici 1").
create or replace function public.mevzuat_madde_getir(p_no text, p_madde text)
returns table (slug text, no text, ad text, durum text, madde text, baslik text, metin text)
language sql stable security definer set search_path = public as $$
  select m.slug, k.no, k.ad, k.durum, m.madde, m.baslik, m.metin
  from public.mevzuat_madde m join public.mevzuat_kanun k on k.slug = m.slug
  where k.no = p_no and lower(m.madde) = lower(p_madde)
  order by k.durum desc
  limit 3
$$;
grant execute on function public.mevzuat_madde_getir(text, text) to authenticated;

-- Arşivin durumu (yönetici panelinde).
create or replace function public.mevzuat_durumu()
returns table (kanun int, mulga int, madde bigint, son timestamptz)
language sql stable security definer set search_path = public as $$
  select (select count(1) from public.mevzuat_kanun where durum = 'yururlukte')::int,
         (select count(1) from public.mevzuat_kanun where durum <> 'yururlukte')::int,
         (select count(1) from public.mevzuat_madde),
         (select max(guncelleme) from public.mevzuat_kanun)
$$;
grant execute on function public.mevzuat_durumu() to authenticated;
