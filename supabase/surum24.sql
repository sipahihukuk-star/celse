-- Sürüm 24: faiz oranlarının günlük denetimi.
-- Her sabah pg_cron, danisma işlevine "faiz_guncelle" gönderir; işlev TCMB'nin resmî tablolarından reeskont (iskonto), avans
-- faiz oranlarını ve TTK m.1530 temerrüt faiz oranını okuyup faiz_oran tablosuna yazar. Uygulama bu tabloyu okur.
-- Oranlar kamuya açık bilgidir: herkes okuyabilir, yalnız sunucu (service_role) yazar.
-- Gereken: surum23.sql (celse_is_anahtari kasada, pg_cron ve pg_net açık).

create table if not exists public.faiz_oran (
  tur text not null check (tur in ('reeskont', 'avans', 'ttk1530', 'yasal')),
  bas date not null,
  oran numeric(7, 3) not null check (oran > 0 and oran < 500),
  kaynak text,
  eklenme timestamptz not null default now(),
  primary key (tur, bas)
);
alter table public.faiz_oran enable row level security;
drop policy if exists "faiz_oran herkes okur" on public.faiz_oran;
create policy "faiz_oran herkes okur" on public.faiz_oran for select to anon, authenticated using (true);
grant select on public.faiz_oran to anon, authenticated;

create table if not exists public.faiz_kontrol (
  id int primary key check (id = 1),
  son timestamptz,
  satir int,
  aciklama text
);
alter table public.faiz_kontrol enable row level security;
drop policy if exists "faiz_kontrol herkes okur" on public.faiz_kontrol;
create policy "faiz_kontrol herkes okur" on public.faiz_kontrol for select to anon, authenticated using (true);
grant select on public.faiz_kontrol to anon, authenticated;

-- Her gün 07.23'te (İstanbul; 04.23 UTC) denetler. TCMB yeni oranı Resmî Gazete'de yayımlandığı gün tabloya ekler.
select cron.unschedule('celse-faiz') where exists (select 1 from cron.job where jobname = 'celse-faiz');
select cron.schedule('celse-faiz', '23 4 1-31 1-12 0-6', $c$
  select net.http_post(
    url := 'https://ouyyfhobpihyrnwlcimo.supabase.co/functions/v1/danisma',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_Q4-NnTAvRCcATNHc-LLogA_iXkjpV2v',
      'x-celse-is', (select decrypted_secret from vault.decrypted_secrets where name = 'celse_is_anahtari')),
    body := '{"action":"faiz_guncelle"}'::jsonb,
    timeout_milliseconds := 60000)
$c$);

-- İlk dolum için hemen bir kez çağırır (sonuç birkaç saniye içinde faiz_kontrol tablosuna düşer).
select net.http_post(
  url := 'https://ouyyfhobpihyrnwlcimo.supabase.co/functions/v1/danisma',
  headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_Q4-NnTAvRCcATNHc-LLogA_iXkjpV2v',
    'x-celse-is', (select decrypted_secret from vault.decrypted_secrets where name = 'celse_is_anahtari')),
  body := '{"action":"faiz_guncelle"}'::jsonb,
  timeout_milliseconds := 60000);
