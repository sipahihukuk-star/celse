-- Celse · 17. kurulum: Dava takibi föylerinin uçtan uca şifreli bulut eşitlemesi (bilgisayar ↔ telefon).
-- - foy_bulut_anahtar: kişinin eşitleme şifresini doğrulamak için tuz ve şifreli doğrulama metni. Şifre ya da anahtar burada YOKTUR;
--   anahtar cihazda şifreden türetilir. Şifre unutulursa buluttaki föyler açılamaz (sunucu da açamaz).
-- - foy_bulut: cihazda AES-256-GCM ile şifrelenmiş kayıtlar. tur: foy (künye, görevler, notlar), metin (evrak metinleri, her evrak
--   ayrı maskelenmiş), ozel (şahsi dosya, şahsi şifreyle de şifreli), kilit (şahsi dosya kilidinin tuzu). Sunucu içeriği okuyamaz;
--   yalnız kayıt kimliği, türü, föyün güncelleme zamanı ve silindi bilgisi açıktır.
-- - Herkes yalnız kendi satırlarını görür ve yazar (RLS). Hesap silinince satırlar da silinir.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

create table if not exists public.foy_bulut_anahtar (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  tuz text not null,
  iv text not null,
  dogrulama text not null,
  olusturma timestamptz not null default now()
);

create table if not exists public.foy_bulut (
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  kayit_id text not null,
  tur text not null check (tur in ('foy', 'metin', 'ozel', 'kilit')),
  iv text not null default '',
  veri text not null default '',
  guncelleme text not null default '',
  silindi boolean not null default false,
  degisim timestamptz not null default now(),
  primary key (kullanici_id, kayit_id),
  constraint foy_bulut_boyut check (length(veri) <= 12000000 and length(kayit_id) <= 200)
);
create index if not exists foy_bulut_degisim on public.foy_bulut (kullanici_id, degisim);

-- Her yazımda değişim zamanı sunucu saatiyle konur (cihazlar "şu andan sonra değişenleri" buna göre çeker).
create or replace function public.foy_bulut_degisim() returns trigger language plpgsql as $$
begin
  new.degisim := clock_timestamp();
  return new;
end; $$;
drop trigger if exists foy_bulut_degisim on public.foy_bulut;
create trigger foy_bulut_degisim before insert or update on public.foy_bulut
  for each row execute function public.foy_bulut_degisim();

alter table public.foy_bulut enable row level security;
alter table public.foy_bulut_anahtar enable row level security;

drop policy if exists foy_bulut_kendi on public.foy_bulut;
create policy foy_bulut_kendi on public.foy_bulut for all to authenticated
  using (kullanici_id = auth.uid()) with check (kullanici_id = auth.uid());
drop policy if exists foy_bulut_anahtar_kendi on public.foy_bulut_anahtar;
create policy foy_bulut_anahtar_kendi on public.foy_bulut_anahtar for all to authenticated
  using (kullanici_id = auth.uid()) with check (kullanici_id = auth.uid());

revoke all on public.foy_bulut from anon;
revoke all on public.foy_bulut_anahtar from anon;
grant select, insert, update, delete on public.foy_bulut to authenticated;
grant select, insert, delete on public.foy_bulut_anahtar to authenticated;
