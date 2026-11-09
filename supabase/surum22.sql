-- Celse · 22. kurulum: İçtihat arşivi ve diğer mevzuat arşivi (KHK, Cumhurbaşkanlığı kararname / yönetmelik / genelge, tüzük,
-- yönetmelik, tebliğ). İçtihat arşivi: Yargıtay, Danıştay, bölge adliye ve ilk derece kararlarının tam metni, Türkçe tam
-- metin aramasıyla. Arşiv iki yoldan dolar: (1) yönetim panelinden temel kararlar (içtihadı birleştirme kararları, genel
-- kurullar, idari ve vergi dava daireleri kurulları) resmî emsal karar servisinden yüklenir; (2) Celse'de açılan her karar
-- arşive eklenir. Kararlar kamuya açık resmî metinlerdir (servis taraf adlarını gizleyerek yayımlar); kullanıcıya ait bilgi yoktur.
-- Okuma: oturum açmış kullanıcılar. Yazma: yalnız sunucu (danisma).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create table if not exists public.ictihat_karar (
  id text primary key,
  mahkeme text not null default '',
  birim text not null default '',
  esas text not null default '',
  karar text not null default '',
  tarih date,
  metin text not null,
  kaynak text not null default 'acilan',
  eklenme timestamptz not null default now(),
  ara tsvector generated always as (to_tsvector('turkish', birim || ' ' || metin)) stored
);
create index if not exists ictihat_karar_ara on public.ictihat_karar using gin (ara);
create index if not exists ictihat_karar_birim on public.ictihat_karar (mahkeme, birim, tarih desc);

alter table public.ictihat_karar enable row level security;
drop policy if exists ictihat_karar_oku on public.ictihat_karar;
create policy ictihat_karar_oku on public.ictihat_karar for select to authenticated using (true);

-- Arşivde arama: sözcüklerle (Türkçe kök), isteğe bağlı mahkeme ve daire süzgeci; en ilgili kararlar ve metinden kısa bölüm.
create or replace function public.ictihat_ara(p_soz text, p_mahkeme text default '', p_birim text default '', p_sinir int default 20)
returns table (id text, mahkeme text, birim text, esas text, karar text, tarih date, bolum text, puan real)
language sql stable security definer set search_path = public as $$
  with q as (select websearch_to_tsquery('turkish', p_soz) as t)
  select k.id, k.mahkeme, k.birim, k.esas, k.karar, k.tarih,
         ts_headline('turkish', left(k.metin, 60000), q.t, 'MaxWords=45, MinWords=20, MaxFragments=2, StartSel=«, StopSel=»'),
         ts_rank(k.ara, q.t)
  from public.ictihat_karar k, q
  where k.ara @@ q.t
    and (coalesce(p_mahkeme, '') = '' or k.mahkeme ilike '%' || p_mahkeme || '%')
    and (coalesce(p_birim, '') = '' or k.birim ilike '%' || p_birim || '%')
  order by ts_rank(k.ara, q.t) desc, k.tarih desc nulls last
  limit least(greatest(p_sinir, 1), 50)
$$;
grant execute on function public.ictihat_ara(text, text, text, int) to authenticated;

-- Arşivin durumu (yönetim panelinde): karar sayısı, mahkemelere göre dağılım, veritabanında kapladığı yer (MB).
create or replace function public.ictihat_durumu()
returns table (karar bigint, yargitay bigint, danistay bigint, diger bigint, mb numeric, son timestamptz)
language sql stable security definer set search_path = public as $$
  select count(1),
         count(1) filter (where mahkeme ilike 'Yargıtay%'),
         count(1) filter (where mahkeme ilike 'Danıştay%'),
         count(1) filter (where mahkeme not ilike 'Yargıtay%' and mahkeme not ilike 'Danıştay%'),
         round(pg_total_relation_size('public.ictihat_karar') / 1048576.0, 1),
         max(eklenme)
  from public.ictihat_karar
$$;
grant execute on function public.ictihat_durumu() to authenticated;

-- Diğer mevzuat arşivi (kanunlar dışı): yönetim panelinden KHK (olağan ve olağanüstü), Cumhurbaşkanlığı kararnameleri,
-- yönetmelikleri ve genelgeleri ile tüzükler yüklenir; Celse'de açılan her yönetmelik, tebliğ ve diğer mevzuat da eklenir.
create table if not exists public.mevzuat_belge (
  id text primary key,
  tur text not null default '',
  tur_ad text not null default '',
  no text not null default '',
  ad text not null default '',
  rg_tarih date,
  rg_sayi text not null default '',
  metin text not null,
  kaynak text not null default 'acilan',
  eklenme timestamptz not null default now(),
  ara tsvector generated always as (to_tsvector('turkish', ad || ' ' || metin)) stored
);
create index if not exists mevzuat_belge_ara on public.mevzuat_belge using gin (ara);
create index if not exists mevzuat_belge_tur on public.mevzuat_belge (tur, rg_tarih desc);
alter table public.mevzuat_belge enable row level security;
drop policy if exists mevzuat_belge_oku on public.mevzuat_belge;
create policy mevzuat_belge_oku on public.mevzuat_belge for select to authenticated using (true);

create or replace function public.mevzuat_belge_ara(p_soz text, p_tur text default '', p_sinir int default 20)
returns table (id text, tur text, tur_ad text, no text, ad text, rg_tarih date, rg_sayi text, bolum text, puan real)
language sql stable security definer set search_path = public as $$
  with q as (select websearch_to_tsquery('turkish', p_soz) as t)
  select b.id, b.tur, b.tur_ad, b.no, b.ad, b.rg_tarih, b.rg_sayi,
         ts_headline('turkish', left(b.metin, 60000), q.t, 'MaxWords=40, MinWords=15, MaxFragments=2, StartSel=«, StopSel=»'),
         ts_rank(b.ara, q.t)
  from public.mevzuat_belge b, q
  where b.ara @@ q.t and (coalesce(p_tur, '') = '' or b.tur = p_tur)
  order by ts_rank(b.ara, q.t) desc, b.rg_tarih desc nulls last
  limit least(greatest(p_sinir, 1), 50)
$$;
grant execute on function public.mevzuat_belge_ara(text, text, int) to authenticated;

create or replace function public.mevzuat_belge_durumu()
returns table (tur text, adet bigint, mb numeric)
language sql stable security definer set search_path = public as $$
  select b.tur, count(1), round(sum(octet_length(b.metin)) / 1048576.0, 1)
  from public.mevzuat_belge b group by b.tur order by b.tur
$$;
grant execute on function public.mevzuat_belge_durumu() to authenticated;
