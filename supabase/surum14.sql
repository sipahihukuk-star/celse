-- Celse · 14. kurulum: yönetim panelinden oyunculara "Derdini anlat" kredisi ve "Evrakla duruşma provası" izni verme.
-- - ozel_yetkiler: oyuncuya tek tek açılan özellikler. evrak = Evrakla duruşma provası (deneme aşaması; yöneticiler her zaman kullanır).
--   Oyuncu yalnız kendi satırını okur; yazma yalnız aşağıdaki yönetici fonksiyonlarıyla olur. danisma fonksiyonu (service role) okur.
-- - yonetici_kredi_ver(p_kullanici, p_miktar): seçilen oyuncunun Derdini anlat kredisine ekler (eksi sayı düşer; sıfırın altına inmez).
--   Dönüş: yeni kredi. Mağaza kaydına (odeme_olaylari) dokunmaz; toplam_alinan yalnız satın almaları sayar.
-- - yonetici_evrak_yetki(p_kullanici, p_acik): Evrakla duruşma provası iznini açar ya da kapatır. Dönüş: yeni durum.
-- - istat_kullanicilar sonuçlarına dokunulmaz; panel izinleri ozel_yetkiler tablosundan ayrıca okur.
-- Supabase > SQL Editor'de bir kez çalıştırılır (surum7 ve surum8'den sonra). Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

create table if not exists public.ozel_yetkiler (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  evrak boolean not null default false,
  guncelleme timestamptz not null default now()
);
alter table public.ozel_yetkiler enable row level security;
drop policy if exists "kendi yetkisini görür" on public.ozel_yetkiler;
create policy "kendi yetkisini görür" on public.ozel_yetkiler for select using (auth.uid() = kullanici_id);
drop policy if exists "yönetici yetkileri görür" on public.ozel_yetkiler;
create policy "yönetici yetkileri görür" on public.ozel_yetkiler for select using (public.yonetici_mi());
grant select on public.ozel_yetkiler to authenticated;
grant select, insert, update on public.ozel_yetkiler to service_role;

-- ---------- kredi ver ----------
create or replace function public.yonetici_kredi_ver(p_kullanici uuid, p_miktar integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_kredi integer;
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  if p_miktar is null or p_miktar = 0 or abs(p_miktar) > 1000 then raise exception 'Geçersiz miktar'; end if;
  insert into public.derdini_kredi as d (kullanici_id, kredi, toplam_alinan, guncelleme)
  values (p_kullanici, greatest(p_miktar, 0), 0, now())
  on conflict (kullanici_id) do update set kredi = greatest(d.kredi + p_miktar, 0), guncelleme = now()
  returning kredi into v_kredi;
  return v_kredi;
end; $$;
revoke all on function public.yonetici_kredi_ver(uuid, integer) from public, anon;
grant execute on function public.yonetici_kredi_ver(uuid, integer) to authenticated;

-- ---------- evrak provası izni ----------
create or replace function public.yonetici_evrak_yetki(p_kullanici uuid, p_acik boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  insert into public.ozel_yetkiler as y (kullanici_id, evrak, guncelleme)
  values (p_kullanici, coalesce(p_acik, false), now())
  on conflict (kullanici_id) do update set evrak = coalesce(p_acik, false), guncelleme = now();
  return coalesce(p_acik, false);
end; $$;
revoke all on function public.yonetici_evrak_yetki(uuid, boolean) from public, anon;
grant execute on function public.yonetici_evrak_yetki(uuid, boolean) to authenticated;
