-- Celse · 12. kurulum: oyuncu durumunun cihazlar arasında eşitlenmesi (iPhone, Android ve web aynı durumu görür).
-- - oyuncu_durumu: her üyenin tek satırı. veri: büro (şehir, yüz, kasa, ay, özel hayat), dosya akışı (teklifler, masadaki
--   ve kapanan dosyalar, odak, uzmanlık) ve seçilen karakter yüzü. Karakter tarifi gönderilmez, cihazda kalır.
-- - surum ve guncelleme sunucuda damgalanır: eklemede surum 1 olur, her güncellemede bir artar; guncelleme sunucu saatidir.
--   Uygulama güncellemeyi "surum = bildiği sürüm" koşuluyla yazar; başka cihaz araya girdiyse yeniden okuyup karar verir.
-- - Oyuncu yalnız kendi satırını görür, ekler ve günceller. Silme yoktur; hesap silinince satır da silinir (on delete cascade).
-- - Çok büyük veri yazılamaz (200 000 bayt sınırı).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

create table if not exists public.oyuncu_durumu (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  veri jsonb not null default '{}'::jsonb,
  surum integer not null default 1,
  guncelleme timestamptz not null default now()
);

alter table public.oyuncu_durumu drop constraint if exists oyuncu_durumu_boy;
alter table public.oyuncu_durumu add constraint oyuncu_durumu_boy check (octet_length(veri::text) < 200000);
alter table public.oyuncu_durumu drop constraint if exists oyuncu_durumu_nesne;
alter table public.oyuncu_durumu add constraint oyuncu_durumu_nesne check (jsonb_typeof(veri) = 'object');

-- Sürüm ve zaman damgası: uygulamanın gönderdiği değerler dikkate alınmaz.
create or replace function public.oyuncu_durumu_damga() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.kullanici_id := old.kullanici_id;
    new.surum := old.surum + 1;
  else
    new.surum := 1;
  end if;
  new.guncelleme := now();
  return new;
end; $$;

drop trigger if exists oyuncu_durumu_damga on public.oyuncu_durumu;
create trigger oyuncu_durumu_damga before insert or update on public.oyuncu_durumu
  for each row execute function public.oyuncu_durumu_damga();

alter table public.oyuncu_durumu enable row level security;

drop policy if exists "kendi durumunu görür" on public.oyuncu_durumu;
create policy "kendi durumunu görür" on public.oyuncu_durumu for select to authenticated
  using (auth.uid() = kullanici_id);
drop policy if exists "kendi durumunu ekler" on public.oyuncu_durumu;
create policy "kendi durumunu ekler" on public.oyuncu_durumu for insert to authenticated
  with check (auth.uid() = kullanici_id);
drop policy if exists "kendi durumunu günceller" on public.oyuncu_durumu;
create policy "kendi durumunu günceller" on public.oyuncu_durumu for update to authenticated
  using (auth.uid() = kullanici_id) with check (auth.uid() = kullanici_id);

revoke all on public.oyuncu_durumu from anon, authenticated;
grant select, insert, update on public.oyuncu_durumu to authenticated;
