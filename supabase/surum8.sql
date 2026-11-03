-- Celse · 8. kurulum: "Derdini anlat" (eğitim amaçlı danışma canlandırması; hukuki görüş değildir, Av. K. m.35).
-- - danismalar: oyuncunun anlattığı olay, yapay zekânın değerlendirmesi, duruşma canlandırması ve takip soruları.
--   Oyuncu yalnız kendi satırlarını görür ve siler; ekleme ve güncelleme yalnız service role (supabase/functions/danisma).
-- - danisma_istekleri: hız sınırı kaydı (kişi başına, işlem türüne göre).
-- - danisma_baslat(): bir krediyi düşer ve danışma satırını tek işlemde açar (yönetici için ücretsiz); kredi yoksa 'kredi yok' hatası.
-- - danisma_iade(): değerlendirme yapılamazsa krediyi geri verir ve yarım kalan satırı siler.
-- - danisma_takip_ayir() / danisma_takip_ekle(): takip sorusu hakkını ayırır (ya da iade eder) ve soru-cevabı ekler.
-- - danisma_sinir(): hız sınırı (son N saniyedeki istek sayısı).
-- Bütün işlevleri yalnız service role çalıştırır. Supabase > SQL Editor'de bir kez çalıştırılır; tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

-- ---------- danışmalar ----------
create table if not exists public.danismalar (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  alan text not null,
  olay text not null,
  deliller text not null,
  karsi text not null,
  talep text not null,
  durum text not null default 'bekliyor',
  degerlendirme text,
  canlandirma text,
  takip jsonb not null default '[]'::jsonb,
  kalan_takip integer not null default 5,
  created_at timestamptz not null default now()
);
alter table public.danismalar add column if not exists dil text not null default 'tr';
alter table public.danismalar add column if not exists ucretsiz boolean not null default false;
alter table public.danismalar drop constraint if exists danismalar_durum_check;
alter table public.danismalar add constraint danismalar_durum_check check (durum in ('bekliyor', 'hazir', 'hata'));
alter table public.danismalar drop constraint if exists danismalar_kalan_takip_check;
alter table public.danismalar add constraint danismalar_kalan_takip_check check (kalan_takip between 0 and 5);
create index if not exists danismalar_kullanici on public.danismalar (kullanici_id, created_at desc);

alter table public.danismalar enable row level security;
drop policy if exists "kendi danışmalarını görür" on public.danismalar;
create policy "kendi danışmalarını görür" on public.danismalar for select using (auth.uid() = kullanici_id);
drop policy if exists "kendi danışmasını siler" on public.danismalar;
create policy "kendi danışmasını siler" on public.danismalar for delete using (auth.uid() = kullanici_id);
-- insert / update ilkesi yok: yalnız service role (RLS'yi aşar) yazar.
revoke all on public.danismalar from anon, authenticated;
grant select, delete on public.danismalar to authenticated;

-- ---------- hız sınırı kaydı ----------
create table if not exists public.danisma_istekleri (
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  tur text not null,
  zaman timestamptz not null default now()
);
create index if not exists danisma_istekleri_k on public.danisma_istekleri (kullanici_id, tur, zaman desc);
alter table public.danisma_istekleri enable row level security;
-- ilke yok: oyuncu bu tabloyu ne okur ne yazar.
revoke all on public.danisma_istekleri from anon, authenticated;

-- ---------- hız sınırı ----------
-- İsteği kaydeder; son p_saniye içinde bu türden p_sinir'den fazla istek varsa false döner.
create or replace function public.danisma_sinir(p_kullanici uuid, p_tur text, p_sinir integer, p_saniye integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_sayi integer;
begin
  -- Aynı kişinin istekleri sırayla sayılır (eşzamanlı isteklerle sınır aşılmasın).
  perform pg_advisory_xact_lock(hashtext('danisma:' || p_kullanici::text));
  delete from public.danisma_istekleri where kullanici_id = p_kullanici and zaman < now() - interval '1 day';
  select count(1) into v_sayi from public.danisma_istekleri
    where kullanici_id = p_kullanici and tur = p_tur and zaman > now() - make_interval(secs => p_saniye);
  if v_sayi >= p_sinir then return false; end if;
  insert into public.danisma_istekleri (kullanici_id, tur) values (p_kullanici, p_tur);
  return true;
end; $$;

-- ---------- krediyi düş ve danışmayı aç (tek işlem) ----------
-- p_ucretsiz: yönetici (yonetici_mi) için true; kredi düşülmez. Dönüş: yeni danışmanın kimliği.
create or replace function public.danisma_baslat(
  p_kullanici uuid, p_alan text, p_olay text, p_deliller text, p_karsi text, p_talep text, p_dil text, p_ucretsiz boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not coalesce(p_ucretsiz, false) then
    update public.derdini_kredi set kredi = kredi - 1, guncelleme = now()
      where kullanici_id = p_kullanici and kredi > 0;
    if not found then raise exception 'kredi yok'; end if;
  end if;
  insert into public.danismalar (kullanici_id, alan, olay, deliller, karsi, talep, dil, ucretsiz, durum)
  values (p_kullanici, p_alan, p_olay, p_deliller, p_karsi, p_talep, coalesce(p_dil, 'tr'), coalesce(p_ucretsiz, false), 'bekliyor')
  returning id into v_id;
  return v_id;
end; $$;

-- ---------- değerlendirme yapılamazsa krediyi geri ver ----------
-- Yalnız 'bekliyor' durumundaki satır için çalışır (aynı danışma iki kez iade edilemez). Dönüş: kredi geri verildiyse true.
create or replace function public.danisma_iade(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_k uuid;
  v_ucretsiz boolean;
begin
  delete from public.danismalar where id = p_id and durum = 'bekliyor' returning kullanici_id, ucretsiz into v_k, v_ucretsiz;
  if not found then return false; end if;
  if v_ucretsiz then return false; end if;
  insert into public.derdini_kredi as d (kullanici_id, kredi, toplam_alinan, guncelleme)
  values (v_k, 1, 0, now())
  on conflict (kullanici_id) do update set kredi = d.kredi + 1, guncelleme = now();
  return true;
end; $$;

-- ---------- takip sorusu hakkı ----------
-- p_iade false: bir hak ayırır; kalan hakkı döner, hak yoksa (ya da danışma o kişinin değilse) -1.
-- p_iade true: model cevap veremezse ayrılan hakkı geri verir.
create or replace function public.danisma_takip_ayir(p_id uuid, p_kullanici uuid, p_iade boolean)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_kalan integer;
begin
  if coalesce(p_iade, false) then
    update public.danismalar set kalan_takip = least(kalan_takip + 1, 5)
      where id = p_id and kullanici_id = p_kullanici returning kalan_takip into v_kalan;
  else
    update public.danismalar set kalan_takip = kalan_takip - 1
      where id = p_id and kullanici_id = p_kullanici and durum = 'hazir' and kalan_takip > 0 returning kalan_takip into v_kalan;
  end if;
  return coalesce(v_kalan, -1);
end; $$;

create or replace function public.danisma_takip_ekle(p_id uuid, p_kullanici uuid, p_soru text, p_cevap text)
returns void
language sql security definer set search_path = public as $$
  update public.danismalar
    set takip = takip || jsonb_build_array(jsonb_build_object('soru', p_soru, 'cevap', p_cevap, 'zaman', now()))
    where id = p_id and kullanici_id = p_kullanici;
$$;

-- ---------- yetkiler: yalnız service role ----------
revoke all on function public.danisma_sinir(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.danisma_sinir(uuid, text, integer, integer) to service_role;
revoke all on function public.danisma_baslat(uuid, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.danisma_baslat(uuid, text, text, text, text, text, text, boolean) to service_role;
revoke all on function public.danisma_iade(uuid) from public, anon, authenticated;
grant execute on function public.danisma_iade(uuid) to service_role;
revoke all on function public.danisma_takip_ayir(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.danisma_takip_ayir(uuid, uuid, boolean) to service_role;
revoke all on function public.danisma_takip_ekle(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.danisma_takip_ekle(uuid, uuid, text, text) to service_role;
grant select, insert, update, delete on public.danismalar to service_role;
grant select, insert, delete on public.danisma_istekleri to service_role;
grant select, insert, update on public.derdini_kredi to service_role;
