-- Celse veritabanı şeması. Supabase > SQL Editor'de bir kez çalıştırılır.
-- Üyelik Supabase Auth ile yapılır; ad soyad ve telefon "profiller" tablosunda, kariyer "kariyer" tablosunda tutulur.

create table if not exists public.profiller (
  id uuid primary key references auth.users (id) on delete cascade,
  ad_soyad text not null,
  telefon text not null,
  eposta text not null,
  kvkk_onay timestamptz not null,
  olusturma timestamptz not null default now()
);

create table if not exists public.kariyer (
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  dava_id text not null,
  oynama integer not null default 0,
  kazandi boolean not null default false,
  en_iyi integer not null default 0,
  guncelleme timestamptz not null default now(),
  primary key (kullanici_id, dava_id)
);

-- Herkes yalnızca kendi satırlarını görür ve değiştirir.
alter table public.profiller enable row level security;
alter table public.kariyer enable row level security;

drop policy if exists "kendi profili" on public.profiller;
create policy "kendi profili" on public.profiller
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "kendi kariyeri" on public.kariyer;
create policy "kendi kariyeri" on public.kariyer
  for all using (auth.uid() = kullanici_id) with check (auth.uid() = kullanici_id);

-- Kayıt olunca profil satırı, kayıt formundaki bilgilerden kendiliğinden oluşturulur.
create or replace function public.yeni_uye()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiller (id, ad_soyad, telefon, eposta, kvkk_onay)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'ad_soyad', ''),
    coalesce(new.raw_user_meta_data ->> 'telefon', ''),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'kvkk_onay')::timestamptz, now())
  );
  return new;
end;
$$;

drop trigger if exists uye_olunca on auth.users;
create trigger uye_olunca after insert on auth.users
  for each row execute function public.yeni_uye();

-- Abonelikler. Satırları yalnızca ödeme bildirimleri (RevenueCat / iyzico webhook'ları, service role anahtarıyla) yazar;
-- oyuncu kendi aboneliğini yalnızca görebilir, değiştiremez.
create table if not exists public.abonelikler (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  bitis timestamptz not null,
  kaynak text not null check (kaynak in ('app_store', 'google_play', 'iyzico', 'manuel')),
  guncelleme timestamptz not null default now()
);
alter table public.abonelikler enable row level security;
drop policy if exists "kendi aboneliğini görür" on public.abonelikler;
create policy "kendi aboneliğini görür" on public.abonelikler
  for select using (auth.uid() = kullanici_id);

-- Seslendirme dosyaları: "seslendir" fonksiyonu yazar (servis anahtarıyla), herkes okuyabilir.
insert into storage.buckets (id, name, public) values ('ses', 'ses', true) on conflict (id) do nothing;
