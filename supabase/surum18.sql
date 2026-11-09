-- Celse · 18. kurulum: Büro ve çalışanlar (dava takibi föylerinin büro içinde uçtan uca şifreli paylaşımı).
-- - buro: büronun adı ve kurucusu.
-- - buro_uye: çalışanlar (ad, ünvan, yetki). Büro anahtarı her üyenin kendi eşitleme anahtarıyla şifrelenmiş olarak
--   burada durur (anahtar_iv, anahtar_veri); sunucu açamaz.
-- - buro_davet: tek kullanımlık davet. Büro anahtarı davet kodundan türetilen anahtarla şifrelidir; kodun kendisi burada
--   yoktur, yalnız SHA-256 özeti vardır. Davet kabul edilince satır silinir; 7 gün sonra geçersizdir.
-- - buro_foy: büro föyleri, büro anahtarıyla cihazda şifrelenmiş. Sunucu içeriği okuyamaz; kayıt kimliği, tür, zaman,
--   yazan kişi ve silindi bilgisi açıktır.
-- Yetkiler sunucuda uygulanır: yonetici (çalışan yönetir, siler), sil (yazar ve siler), yaz (yazar, silemez).
-- Bir kişi aynı anda tek büroda olabilir. Çalışan büro dışına çıkarılınca büro kayıtlarını hemen göremez olur.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

create table if not exists public.buro (
  id uuid primary key default gen_random_uuid(),
  ad text not null default '' check (length(ad) <= 200),
  kurucu uuid not null references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now()
);

create table if not exists public.buro_uye (
  buro_id uuid not null references public.buro(id) on delete cascade,
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  ad text not null default '' check (length(ad) <= 200),
  unvan text not null default 'Avukat' check (length(unvan) <= 100),
  yetki text not null default 'yaz' check (yetki in ('yonetici', 'sil', 'yaz')),
  anahtar_iv text not null default '',
  anahtar_veri text not null default '',
  katilma timestamptz not null default now(),
  primary key (buro_id, kullanici_id)
);
create unique index if not exists buro_uye_tek_buro on public.buro_uye (kullanici_id);

create table if not exists public.buro_davet (
  id uuid primary key default gen_random_uuid(),
  buro_id uuid not null references public.buro(id) on delete cascade,
  kod_ozet text not null unique,
  ad text not null default '' check (length(ad) <= 200),
  unvan text not null default 'Avukat' check (length(unvan) <= 100),
  yetki text not null default 'yaz' check (yetki in ('yonetici', 'sil', 'yaz')),
  tuz text not null,
  iv text not null,
  veri text not null,
  son timestamptz not null default now() + interval '7 days',
  olusturan uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now()
);

create table if not exists public.buro_foy (
  buro_id uuid not null references public.buro(id) on delete cascade,
  kayit_id text not null,
  tur text not null check (tur in ('foy', 'metin')),
  iv text not null default '',
  veri text not null default '',
  guncelleme text not null default '',
  silindi boolean not null default false,
  degisim timestamptz not null default now(),
  yazan uuid references auth.users(id) on delete set null,
  primary key (buro_id, kayit_id),
  constraint buro_foy_boyut check (length(veri) <= 12000000 and length(kayit_id) <= 200)
);
create index if not exists buro_foy_degisim on public.buro_foy (buro_id, degisim);

-- Çağıranın bu bürodaki yetkisi (üye değilse null).
create or replace function public.buro_yetkim(p_buro uuid) returns text
language sql stable security definer set search_path = public as $$
  select yetki from public.buro_uye where buro_id = p_buro and kullanici_id = auth.uid()
$$;

-- buro_foy: değişim zamanı sunucu saatiyle, yazan çağıran kişi; silme yalnız sil ya da yonetici yetkisiyle.
create or replace function public.buro_foy_yazim() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.degisim := clock_timestamp();
  new.yazan := auth.uid();
  if new.silindi and (tg_op = 'INSERT' or not old.silindi) and coalesce(public.buro_yetkim(new.buro_id), '') not in ('yonetici', 'sil') then
    raise exception 'Bu ünvanın föy silme yetkisi yok.';
  end if;
  return new;
end; $$;
drop trigger if exists buro_foy_yazim on public.buro_foy;
create trigger buro_foy_yazim before insert or update on public.buro_foy
  for each row execute function public.buro_foy_yazim();

-- buro_uye: ünvan ve yetkiyi yalnız yönetici değiştirir; kurucu yönetici kalır; büro anahtarını herkes yalnız kendi satırına yazar.
create or replace function public.buro_uye_degisim() returns trigger language plpgsql security definer set search_path = public as $$
declare v_kurucu uuid;
begin
  select kurucu into v_kurucu from public.buro where id = new.buro_id;
  if (new.yetki is distinct from old.yetki or new.unvan is distinct from old.unvan) and coalesce(public.buro_yetkim(new.buro_id), '') <> 'yonetici' then
    raise exception 'Ünvan ve yetkiyi yalnız büro yöneticisi değiştirebilir.';
  end if;
  if new.kullanici_id = v_kurucu and new.yetki <> 'yonetici' then
    raise exception 'Büroyu kuran avukat yönetici kalır.';
  end if;
  if (new.anahtar_veri is distinct from old.anahtar_veri or new.anahtar_iv is distinct from old.anahtar_iv or new.ad is distinct from old.ad) and new.kullanici_id <> auth.uid() then
    raise exception 'Bu alanı yalnız çalışanın kendisi değiştirebilir.';
  end if;
  if new.buro_id <> old.buro_id or new.kullanici_id <> old.kullanici_id then
    raise exception 'Üye başka büroya taşınamaz.';
  end if;
  return new;
end; $$;
drop trigger if exists buro_uye_degisim on public.buro_uye;
create trigger buro_uye_degisim before update on public.buro_uye
  for each row execute function public.buro_uye_degisim();

-- Büro kurma: büro ve kurucunun yönetici üyeliği birlikte açılır.
create or replace function public.buro_kur(p_ad text, p_benim_adim text, p_anahtar_iv text, p_anahtar_veri text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Giriş yapılmamış.'; end if;
  if exists (select 1 from public.buro_uye where kullanici_id = auth.uid()) then raise exception 'Zaten bir büronun üyesisiniz.'; end if;
  insert into public.buro (ad, kurucu) values (left(p_ad, 200), auth.uid()) returning id into v_id;
  insert into public.buro_uye (buro_id, kullanici_id, ad, unvan, yetki, anahtar_iv, anahtar_veri)
    values (v_id, auth.uid(), left(p_benim_adim, 200), 'Kurucu avukat', 'yonetici', p_anahtar_iv, p_anahtar_veri);
  return v_id;
end; $$;

-- Davet kabulü: kod özetiyle davet bulunur, çağıran üye yapılır, davet silinir; şifreli büro anahtarı döner.
create or replace function public.buro_davet_kabul(p_kod_ozet text, p_ad text) returns json
language plpgsql security definer set search_path = public as $$
declare d public.buro_davet;
begin
  if auth.uid() is null then raise exception 'Giriş yapılmamış.'; end if;
  select x.id, x.buro_id, x.kod_ozet, x.ad, x.unvan, x.yetki, x.tuz, x.iv, x.veri, x.son, x.olusturan, x.olusturma
    into d from public.buro_davet x where x.kod_ozet = p_kod_ozet;
  if d.id is null or d.son < now() then raise exception 'Davet kodu geçersiz ya da süresi dolmuş.'; end if;
  if exists (select 1 from public.buro_uye where kullanici_id = auth.uid()) then raise exception 'Zaten bir büronun üyesisiniz.'; end if;
  insert into public.buro_uye (buro_id, kullanici_id, ad, unvan, yetki)
    values (d.buro_id, auth.uid(), left(coalesce(nullif(p_ad, ''), d.ad), 200), d.unvan, d.yetki);
  delete from public.buro_davet where id = d.id;
  return json_build_object('buro_id', d.buro_id, 'tuz', d.tuz, 'iv', d.iv, 'veri', d.veri, 'unvan', d.unvan, 'yetki', d.yetki);
end; $$;

alter table public.buro enable row level security;
alter table public.buro_uye enable row level security;
alter table public.buro_davet enable row level security;
alter table public.buro_foy enable row level security;

drop policy if exists buro_gor on public.buro;
create policy buro_gor on public.buro for select to authenticated using (public.buro_yetkim(id) is not null);
drop policy if exists buro_duzelt on public.buro;
create policy buro_duzelt on public.buro for update to authenticated using (kurucu = auth.uid()) with check (kurucu = auth.uid());
drop policy if exists buro_kapat on public.buro;
create policy buro_kapat on public.buro for delete to authenticated using (kurucu = auth.uid());

drop policy if exists buro_uye_gor on public.buro_uye;
create policy buro_uye_gor on public.buro_uye for select to authenticated using (public.buro_yetkim(buro_id) is not null);
drop policy if exists buro_uye_duzelt on public.buro_uye;
create policy buro_uye_duzelt on public.buro_uye for update to authenticated
  using (kullanici_id = auth.uid() or public.buro_yetkim(buro_id) = 'yonetici')
  with check (kullanici_id = auth.uid() or public.buro_yetkim(buro_id) = 'yonetici');
drop policy if exists buro_uye_cikar on public.buro_uye;
create policy buro_uye_cikar on public.buro_uye for delete to authenticated
  using ((kullanici_id = auth.uid() or public.buro_yetkim(buro_id) = 'yonetici')
    and kullanici_id <> (select b.kurucu from public.buro b where b.id = buro_id));

drop policy if exists buro_davet_yonetici on public.buro_davet;
create policy buro_davet_yonetici on public.buro_davet for all to authenticated
  using (public.buro_yetkim(buro_id) = 'yonetici') with check (public.buro_yetkim(buro_id) = 'yonetici' and olusturan = auth.uid());

drop policy if exists buro_foy_gor on public.buro_foy;
create policy buro_foy_gor on public.buro_foy for select to authenticated using (public.buro_yetkim(buro_id) is not null);
drop policy if exists buro_foy_ekle on public.buro_foy;
create policy buro_foy_ekle on public.buro_foy for insert to authenticated with check (public.buro_yetkim(buro_id) in ('yonetici', 'sil', 'yaz'));
drop policy if exists buro_foy_yaz on public.buro_foy;
create policy buro_foy_yaz on public.buro_foy for update to authenticated
  using (public.buro_yetkim(buro_id) in ('yonetici', 'sil', 'yaz')) with check (public.buro_yetkim(buro_id) in ('yonetici', 'sil', 'yaz'));

revoke all on public.buro, public.buro_uye, public.buro_davet, public.buro_foy from anon;
grant select, update, delete on public.buro to authenticated;
grant select, update, delete on public.buro_uye to authenticated;
grant select, insert, delete on public.buro_davet to authenticated;
grant select, insert, update on public.buro_foy to authenticated;
revoke all on function public.buro_kur(text, text, text, text) from anon;
revoke all on function public.buro_davet_kabul(text, text) from anon;
grant execute on function public.buro_kur(text, text, text, text) to authenticated;
grant execute on function public.buro_davet_kabul(text, text) to authenticated;
grant execute on function public.buro_yetkim(uuid) to authenticated;
