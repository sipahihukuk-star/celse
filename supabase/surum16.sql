-- Celse · 16. kurulum: üç yüz (Dava takibi, Derdini anlat, Kariyer ve oyun) için kişi başına izin ve yüz başına istatistik.
-- - ozel_yetkiler.yuzler: kişinin kullanabileceği yüzler ('takip', 'danisma', 'oyun'). Boş (null) = üçü de açık.
--   Kişi yalnız kendi satırını okur; yazma yalnız yonetici_yuz_yetki ile olur. Uygulama kapalı yüzü ön sayfada göstermez.
-- - yonetici_yuz_yetki(p_kullanici, p_yuzler): yüzleri ayarlar. Üçü birden seçilirse null yazılır (hepsi açık). Dönüş: yeni liste.
-- - istat_yuzler(p_gun): yönetim panelinde Dava takibi ve Derdini anlat yüzleri için özet (danışma sayısı, kişi, kredi,
--   avukat paketi, avukat kredisi kullanımı). Oyun istatistikleri eski fonksiyonlarda (surum9.sql) kalır.
-- - danismalar.evrak: vatandaşın Derdini anlat'a eklediği evrakın cihazda kodlanmış metni (gerçek adlar cihazda kalır).
--   Değerlendirme, canlandırma ve takip soruları buna da dayanır. Danışma silinince birlikte silinir.
-- Supabase > SQL Editor'de bir kez çalıştırılır (surum14 ve surum15'ten sonra). Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

alter table public.ozel_yetkiler add column if not exists yuzler text[];
alter table public.danismalar add column if not exists evrak text;

create or replace function public.yonetici_yuz_yetki(p_kullanici uuid, p_yuzler text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  select array_agg(x order by array_position(array['takip', 'danisma', 'oyun'], x)) into v
    from (select distinct unnest(coalesce(p_yuzler, array[]::text[])) as x) s
    where x in ('takip', 'danisma', 'oyun');
  if v is null or array_length(v, 1) is null then raise exception 'En az bir yüz açık kalmalı'; end if;
  if array_length(v, 1) = 3 then v := null; end if;
  insert into public.ozel_yetkiler as y (kullanici_id, yuzler, guncelleme)
  values (p_kullanici, v, now())
  on conflict (kullanici_id) do update set yuzler = v, guncelleme = now();
  return coalesce(v, array['takip', 'danisma', 'oyun']);
end; $$;
revoke all on function public.yonetici_yuz_yetki(uuid, text[]) from public, anon;
grant execute on function public.yonetici_yuz_yetki(uuid, text[]) to authenticated;

create or replace function public.istat_yuzler(p_gun integer default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_bas timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_gun, 30), 3650)));
  v jsonb;
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  select jsonb_build_object(
    'danisma_sayi', (select count(id) from public.danismalar where created_at >= v_bas),
    'danisma_kisi', (select count(distinct kullanici_id) from public.danismalar where created_at >= v_bas),
    'danisma_ucretsiz', (select count(id) from public.danismalar where created_at >= v_bas and ucretsiz),
    'kredi_kalan', (select coalesce(sum(kredi), 0) from public.derdini_kredi),
    'kredi_alinan', (select coalesce(sum(toplam_alinan), 0) from public.derdini_kredi),
    'kredili_kisi', (select count(kullanici_id) from public.derdini_kredi where kredi > 0),
    'evrak_izinli', (select count(kullanici_id) from public.ozel_yetkiler where evrak),
    'avukat_aktif', (select count(kullanici_id) from public.avukat_paket where bitis > now()),
    'avukat_ucretli', (select count(kullanici_id) from public.avukat_paket where bitis > now() and kaynak <> 'manuel'),
    'avukat_kredi', (select coalesce(sum(kredi), 0) from public.avukat_kullanim where created_at >= v_bas),
    'avukat_islem', (select count(id) from public.avukat_kullanim where created_at >= v_bas),
    'avukat_kisi', (select count(distinct kullanici_id) from public.avukat_kullanim where created_at >= v_bas),
    'yuz_takip', (select count(kullanici_id) from public.ozel_yetkiler where yuzler is not null and 'takip' = any(yuzler)),
    'yuz_danisma', (select count(kullanici_id) from public.ozel_yetkiler where yuzler is not null and 'danisma' = any(yuzler)),
    'yuz_oyun', (select count(kullanici_id) from public.ozel_yetkiler where yuzler is not null and 'oyun' = any(yuzler)),
    'yuz_kisitli', (select count(kullanici_id) from public.ozel_yetkiler where yuzler is not null)
  ) into v;
  return v;
end; $$;
revoke all on function public.istat_yuzler(integer) from public, anon;
grant execute on function public.istat_yuzler(integer) to authenticated;
