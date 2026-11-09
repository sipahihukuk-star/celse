-- Celse · 19. kurulum: Yönetim panelinde dava takibine özgü istatistikler ve kullanıcı bilgisi.
-- - istek_gunluk: yapay zekâ isteklerinin günlük sayısı (işlem türü ve kişi başına). Hız sınırı kaydı bir gün sonra
--   silindiği için uzun dönem sayıları burada tutulur. İçerik yoktur; yalnız gün, tür, kişi ve sayı.
-- - danisma_sinir: aynı davranış; izin verilen her istek ayrıca günlük sayıya eklenir.
-- - istat_takip: dava takibi istatistikleri (yalnız yönetici). Föylerin içeriği sunucuda şifrelidir; burada yalnız sayılar var.
-- - yonetici_takip_kullanicilari: kullanıcı başına büro, ünvan, eşitleme ve kullanım sayıları (yalnız yönetici).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create table if not exists public.istek_gunluk (
  gun date not null default current_date,
  tur text not null,
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  sayi integer not null default 0,
  primary key (gun, tur, kullanici_id)
);
alter table public.istek_gunluk enable row level security;
revoke all on public.istek_gunluk from anon, authenticated;

create or replace function public.danisma_sinir(p_kullanici uuid, p_tur text, p_sinir integer, p_saniye integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_sayi integer;
begin
  perform pg_advisory_xact_lock(hashtext('danisma:' || p_kullanici::text));
  delete from public.danisma_istekleri where kullanici_id = p_kullanici and zaman < now() - interval '1 day';
  select count(1) into v_sayi from public.danisma_istekleri
    where kullanici_id = p_kullanici and tur = p_tur and zaman > now() - make_interval(secs => p_saniye);
  if v_sayi >= p_sinir then return false; end if;
  insert into public.danisma_istekleri (kullanici_id, tur) values (p_kullanici, p_tur);
  insert into public.istek_gunluk (gun, tur, kullanici_id, sayi) values (current_date, p_tur, p_kullanici, 1)
    on conflict (gun, tur, kullanici_id) do update set sayi = public.istek_gunluk.sayi + 1;
  return true;
end; $$;

create or replace function public.istat_takip(p_gun integer default 30) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_bas timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_gun, 30), 3650)));
  v_gun date := (now() - make_interval(days => greatest(1, least(coalesce(p_gun, 30), 3650))))::date;
  v jsonb;
begin
  if not coalesce(public.yonetici_mi(), false) then raise exception 'Yetki yok'; end if;
  select jsonb_build_object(
    'kullanici', (select count(id) from public.profiller),
    'avukat_aktif', (select count(kullanici_id) from public.avukat_paket where bitis > now()),
    'avukat_ucretli', (select count(kullanici_id) from public.avukat_paket where bitis > now() and kaynak <> 'manuel'),
    'esitleme', (select count(kullanici_id) from public.foy_bulut_anahtar),
    'bulut_foy', (select count(kayit_id) from public.foy_bulut where tur = 'foy' and not silindi),
    'bulut_kisi', (select count(distinct kullanici_id) from public.foy_bulut where tur = 'foy' and not silindi),
    'aktif_kisi', (select count(distinct k) from (
        select kullanici_id as k from public.foy_bulut where degisim >= v_bas
        union select yazan from public.buro_foy where degisim >= v_bas and yazan is not null) x),
    'degisen_foy', (select count(kayit_id) from public.foy_bulut where tur = 'foy' and degisim >= v_bas)
      + (select count(kayit_id) from public.buro_foy where tur = 'foy' and degisim >= v_bas),
    'buro', (select count(id) from public.buro),
    'buro_cok', (select count(1) from (select buro_id from public.buro_uye group by buro_id having count(kullanici_id) > 1) x),
    'buro_uye', (select count(kullanici_id) from public.buro_uye),
    'buro_foy', (select count(kayit_id) from public.buro_foy where tur = 'foy' and not silindi),
    'davet_bekleyen', (select count(id) from public.buro_davet where son > now()),
    'unvanlar', (select coalesce(jsonb_object_agg(unvan, n), '{}'::jsonb) from (select unvan, count(kullanici_id) as n from public.buro_uye group by unvan) x),
    'yz', (select coalesce(jsonb_object_agg(tur, n), '{}'::jsonb) from (select tur, sum(sayi) as n from public.istek_gunluk where gun >= v_gun group by tur) x),
    'yz_kisi', (select coalesce(jsonb_object_agg(tur, n), '{}'::jsonb) from (select tur, count(distinct kullanici_id) as n from public.istek_gunluk where gun >= v_gun group by tur) x),
    'yz_gunluk', (select coalesce(jsonb_agg(jsonb_build_object('gun', gun, 'n', n) order by gun), '[]'::jsonb) from (
        select gun, sum(sayi) as n from public.istek_gunluk where gun >= v_gun and tur in ('foy_sor', 'foyle', 'evrak', 'evrak_derle', 'evrak_izle', 'evrak_oyna') group by gun) x)
  ) into v;
  return v;
end; $$;
revoke all on function public.istat_takip(integer) from public, anon;
grant execute on function public.istat_takip(integer) to authenticated;

create or replace function public.yonetici_takip_kullanicilari(p_gun integer default 30)
returns table (kullanici_id uuid, buro_ad text, unvan text, yetki text, esitleme boolean, bulut_foy integer, son_esitleme timestamptz, yz_istek integer)
language plpgsql security definer set search_path = public as $$
declare v_gun date := (now() - make_interval(days => greatest(1, least(coalesce(p_gun, 30), 3650))))::date;
begin
  if not coalesce(public.yonetici_mi(), false) then raise exception 'Yetki yok'; end if;
  return query
  select p.id,
    b.ad, u.unvan, u.yetki,
    exists (select 1 from public.foy_bulut_anahtar a where a.kullanici_id = p.id),
    ((select count(f.kayit_id) from public.foy_bulut f where f.kullanici_id = p.id and f.tur = 'foy' and not f.silindi)
      + (select count(g.kayit_id) from public.buro_foy g where g.yazan = p.id and g.tur = 'foy' and not g.silindi))::integer,
    greatest((select max(f.degisim) from public.foy_bulut f where f.kullanici_id = p.id), (select max(g.degisim) from public.buro_foy g where g.yazan = p.id)),
    (select coalesce(sum(i.sayi), 0) from public.istek_gunluk i where i.kullanici_id = p.id and i.gun >= v_gun and i.tur in ('foy_sor', 'foyle', 'evrak', 'evrak_derle', 'evrak_izle', 'evrak_oyna'))::integer
  from public.profiller p
  left join public.buro_uye u on u.kullanici_id = p.id
  left join public.buro b on b.id = u.buro_id;
end; $$;
revoke all on function public.yonetici_takip_kullanicilari(integer) from public, anon;
grant execute on function public.yonetici_takip_kullanicilari(integer) to authenticated;
