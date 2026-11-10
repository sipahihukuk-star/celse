-- Celse · 23. kurulum: içtihat arşivinin SUNUCUDA sürekli yüklenmesi (tarayıcıyı açık tutmak gerekmez).
-- Yönetim panelinde başlatılan plan (mahkeme / kurul / yıl listesi) ictihat_is tablosunda durur; pg_cron yaklaşık her dakika
-- danisma fonksiyonunu çağırır, fonksiyon kaldığı yerden bir tur (~90 saniye) yükler. Çağrı, veritabanı kasasında (Vault) bu
-- kurulumda üretilen gizli anahtarla doğrulanır; anahtar hiçbir yere kopyalanmaz.
-- Arşiv sınırı (MB) panelden ayarlanır: ücretsiz planda 300, Pro planda 6000 önerilir.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır (iş durumu korunur).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.ictihat_is (
  id int primary key default 1 check (id = 1),
  plan jsonb not null default '[]'::jsonb,
  i int not null default 0,
  sayfa int not null default 1,
  durum text not null default 'durdu',
  sinir_mb int not null default 300,
  eklenen bigint not null default 0,
  son_hata text not null default '',
  son_calisma timestamptz,
  kilit timestamptz,
  guncelleme timestamptz not null default now()
);
alter table public.ictihat_is enable row level security;
insert into public.ictihat_is (id) values (1) on conflict (id) do nothing;

-- Gizli anahtar (yalnız bir kez üretilir).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'celse_is_anahtari') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'celse_is_anahtari', 'Celse zamanlanmış içtihat yüklemesi');
  end if;
end $$;

-- Yönetici: planı başlatır (bastan = true ise baştan), sınırı ayarlar.
create or replace function public.ictihat_is_baslat(p_plan jsonb, p_sinir int, p_bastan boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.ictihat_is set
    plan = coalesce(p_plan, plan),
    sinir_mb = greatest(50, least(7000, coalesce(p_sinir, sinir_mb))),
    i = case when p_bastan or plan is distinct from p_plan then 0 else i end,
    sayfa = case when p_bastan or plan is distinct from p_plan then 1 else sayfa end,
    durum = 'calisiyor', son_hata = '', kilit = null, guncelleme = now()
  where id = 1;
end $$;
grant execute on function public.ictihat_is_baslat(jsonb, int, boolean) to authenticated;

create or replace function public.ictihat_is_durdur()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  update public.ictihat_is set durum = 'durdu', guncelleme = now() where id = 1;
end $$;
grant execute on function public.ictihat_is_durdur() to authenticated;

create or replace function public.ictihat_is_durumu()
returns table (plan jsonb, i int, sayfa int, durum text, sinir_mb int, eklenen bigint, son_hata text, son_calisma timestamptz, calisiyor_mu boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.yonetici_mi() then raise exception 'yetki yok'; end if;
  return query select j.plan, j.i, j.sayfa, j.durum, j.sinir_mb, j.eklenen, j.son_hata, j.son_calisma, (j.kilit is not null and j.kilit > now())
    from public.ictihat_is j where j.id = 1;
end $$;
grant execute on function public.ictihat_is_durumu() to authenticated;

-- Yalnız sunucu (danisma, servis anahtarıyla) çağırır.
create or replace function public.ictihat_is_anahtar(p_anahtar text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'celse_is_anahtari' and decrypted_secret = p_anahtar)
$$;

create or replace function public.ictihat_is_al()
returns table (plan jsonb, i int, sayfa int, sinir_mb int)
language sql security definer set search_path = public as $$
  update public.ictihat_is j set kilit = now() + interval '3 minutes'
  where j.id = 1 and j.durum = 'calisiyor' and (j.kilit is null or j.kilit < now())
  returning j.plan, j.i, j.sayfa, j.sinir_mb
$$;

create or replace function public.ictihat_is_kaydet(p_i int, p_sayfa int, p_eklenen int)
returns void language sql security definer set search_path = public as $$
  update public.ictihat_is set i = p_i, sayfa = p_sayfa, eklenen = eklenen + coalesce(p_eklenen, 0), son_calisma = now() where id = 1
$$;

create or replace function public.ictihat_is_birak(p_hata text, p_durum text)
returns void language sql security definer set search_path = public as $$
  update public.ictihat_is set kilit = null, son_hata = coalesce(p_hata, ''), son_calisma = now(),
    durum = case when p_durum in ('bitti', 'dolu') and durum = 'calisiyor' then p_durum else durum end
  where id = 1
$$;

revoke all on function public.ictihat_is_anahtar(text) from public, anon, authenticated;
revoke all on function public.ictihat_is_al() from public, anon, authenticated;
revoke all on function public.ictihat_is_kaydet(int, int, int) from public, anon, authenticated;
revoke all on function public.ictihat_is_birak(text, text) from public, anon, authenticated;
grant execute on function public.ictihat_is_anahtar(text) to service_role;
grant execute on function public.ictihat_is_al() to service_role;
grant execute on function public.ictihat_is_kaydet(int, int, int) to service_role;
grant execute on function public.ictihat_is_birak(text, text) to service_role;

-- Doğrulamada esas ve karar numarasıyla hızlı bakış.
create index if not exists ictihat_karar_esas on public.ictihat_karar (esas, karar);

-- Zamanlanmış çağrı: iş "çalışıyor" ve kilitsizken 50 saniyede bir danisma'ya istek gider.
select cron.unschedule('celse-ictihat') where exists (select 1 from cron.job where jobname = 'celse-ictihat');
select cron.schedule('celse-ictihat', '50 seconds', $c$
  select net.http_post(
    url := 'https://ouyyfhobpihyrnwlcimo.supabase.co/functions/v1/danisma',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_Q4-NnTAvRCcATNHc-LLogA_iXkjpV2v',
      'x-celse-is', (select decrypted_secret from vault.decrypted_secrets where name = 'celse_is_anahtari')),
    body := '{"action":"ictihat_is"}'::jsonb,
    timeout_milliseconds := 150000)
  where exists (select 1 from public.ictihat_is where durum = 'calisiyor' and (kilit is null or kilit < now()))
$c$);
