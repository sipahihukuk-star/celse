-- Celse · 4. kurulum: oyun ayarları (not kırma oranı vb.). Herkes okur, yalnız yönetici yazar.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create table if not exists public.ayarlar (
  anahtar text primary key,
  deger jsonb not null,
  guncelleme timestamptz not null default now()
);
alter table public.ayarlar enable row level security;
drop policy if exists "ayarları herkes okur" on public.ayarlar;
create policy "ayarları herkes okur" on public.ayarlar for select using (true);
drop policy if exists "ayarları yönetici yazar" on public.ayarlar;
create policy "ayarları yönetici yazar" on public.ayarlar for all using (public.yonetici_mi()) with check (public.yonetici_mi());

insert into public.ayarlar (anahtar, deger) values ('oyun', '{"notKirma": 1, "notKirmaArtis": 0.15}'::jsonb)
on conflict (anahtar) do nothing;
