-- Celse · 6. kurulum: liderlik panosu.
-- Her kariyer davasının pano puanı kariyer tablosuna yazılır; puan artışları ayrıca kaydedilir (aylık sıralama için).
-- Panoda yalnızca kendisi katılmayı seçen oyuncular "Ad S." biçiminde görünür.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

alter table public.kariyer add column if not exists seviye smallint not null default 1;
alter table public.kariyer add column if not exists puan integer not null default 0;
alter table public.kariyer drop constraint if exists kariyer_puan_sinir;
alter table public.kariyer add constraint kariyer_puan_sinir check (puan between 0 and 400 and seviye between 1 and 5);

-- Puan artışları: bir davada daha yüksek pano puanı alındığında artış miktarı yazılır.
create table if not exists public.puan_gecmisi (
  id bigserial primary key,
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  dava_id text not null,
  artis integer not null check (artis between 1 and 400),
  zaman timestamptz not null default now()
);
create index if not exists puan_gecmisi_zaman on public.puan_gecmisi (zaman);
alter table public.puan_gecmisi enable row level security;
drop policy if exists "kendi puanını yazar" on public.puan_gecmisi;
create policy "kendi puanını yazar" on public.puan_gecmisi for insert to authenticated with check (auth.uid() = kullanici_id);
drop policy if exists "kendi puanını görür" on public.puan_gecmisi;
create policy "kendi puanını görür" on public.puan_gecmisi for select using (auth.uid() = kullanici_id);

-- Panoya katılan oyuncular ve görünen bilgileri.
create table if not exists public.pano (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  gorunen_ad text not null check (char_length(gorunen_ad) between 2 and 40),
  sehir text check (char_length(sehir) <= 40),
  avatar text check (char_length(avatar) <= 40),
  unvan text check (char_length(unvan) <= 60),
  guncelleme timestamptz not null default now()
);
alter table public.pano enable row level security;
drop policy if exists "kendi pano satırı" on public.pano;
create policy "kendi pano satırı" on public.pano for all using (auth.uid() = kullanici_id) with check (auth.uid() = kullanici_id);
drop policy if exists "yönetici panoyu yönetir" on public.pano;
create policy "yönetici panoyu yönetir" on public.pano for all using (public.yonetici_mi()) with check (public.yonetici_mi());

-- Sıralama: ilk 50 ve (panodaysa) çağıran oyuncunun kendi satırı.
-- donem: 'tum' (bütün zamanlar) ya da 'ay' (İstanbul saatine göre bu ayın başından beri kazanılan puan).
create or replace function public.liderlik(donem text default 'tum', sehir_f text default null)
returns table (sira bigint, ad text, sehir text, avatar text, unvan text, puan bigint, kazanilan bigint, dava bigint, ben boolean)
language sql stable security definer set search_path = public as $$
  with ay_basi as (select (date_trunc('month', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as t),
  toplam as (
    select k.kullanici_id, sum(k.puan)::bigint as puan,
           count(*) filter (where k.kazandi)::bigint as kazanilan, count(*)::bigint as dava
    from public.kariyer k group by k.kullanici_id
  ),
  aylik as (
    select g.kullanici_id, sum(g.artis)::bigint as puan
    from public.puan_gecmisi g, ay_basi where g.zaman >= ay_basi.t group by g.kullanici_id
  ),
  satir as (
    select p.kullanici_id, p.gorunen_ad, p.sehir, p.avatar, p.unvan,
           case when donem = 'ay' then coalesce(a.puan, 0) else t.puan end as puan, t.kazanilan, t.dava
    from public.pano p
    join toplam t on t.kullanici_id = p.kullanici_id
    left join aylik a on a.kullanici_id = p.kullanici_id
    where (sehir_f is null or p.sehir = sehir_f)
  ),
  sirali as (
    select s.*, rank() over (order by s.puan desc, s.kazanilan desc) as sira from satir s where s.puan > 0
  )
  select sira, gorunen_ad, sehir, avatar, unvan, puan, kazanilan, dava, kullanici_id = auth.uid()
  from sirali where sira <= 50 or kullanici_id = auth.uid() order by sira limit 51;
$$;
revoke all on function public.liderlik(text, text) from public;
grant execute on function public.liderlik(text, text) to anon, authenticated;
