-- Celse · 15. kurulum: Celse Avukat paketi (Evrakla duruşma provası aboneliği; Celse Pro dahil).
-- - avukat_paket: oyuncu başına paket. bitis geçmemişse paket etkindir. Her ay (donem_bas'tan itibaren) aylik_kredi kadar kredi açılır;
--   kullanilan o dönemde harcanan kredidir. Dönem dolunca kullanilan sıfırlanır ve donem_bas bir ay ileri alınır.
--   Yönetici ek kredi verirse kullanilan eksiye iner (o dönem için fazladan hak); dönem dönünce sıfırlanır.
--   kaynak: app_store, google_play, iyzico, revenuecat, test_store ya da manuel (yönetici).
-- - avukat_kullanim: her düşme ve iade kaydı (tur: evrak, evrak_izle, evrak_oyna, iade, yonetici).
-- - avukat_kredi_dus(p_kullanici, p_kredi, p_tur): danisma fonksiyonu (service role) çağırır. Paket yoksa 'paket yok',
--   dönemde yeterli kredi yoksa 'kredi yok' hatası. Dönüş: kalan kredi.
-- - avukat_kredi_iade(p_kullanici, p_kredi, p_tur): yapay zekâ cevap üretemezse düşülen kredi geri verilir.
-- - avukat_odeme(p_kullanici, p_bitis, p_kaynak, p_yenilenecek): ödeme bildirimi (odeme fonksiyonu) paketi açar ya da uzatır.
-- - avukat_durumum(): giriş yapmış oyuncunun paket durumu (etkin mi, bitiş, aylık kredi, kalan, dönem sonu).
-- - yonetici_avukat_paket(p_kullanici, p_bitis): yönetici ücretsiz (manuel) paket verir; p_bitis boşsa manuel paketi kaldırır.
-- - yonetici_avukat_kredi(p_kullanici, p_miktar): yönetici bu döneme ek kredi verir (eksi sayı geri alır).
-- - yonetici_avukat_listesi(): yönetim paneli için bütün paketler, kalan krediyle.
-- Supabase > SQL Editor'de bir kez çalıştırılır (surum14'ten sonra). Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

create table if not exists public.avukat_paket (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  bitis timestamptz not null,
  kaynak text not null default 'manuel',
  aylik_kredi integer not null default 160,
  donem_bas timestamptz not null default now(),
  kullanilan integer not null default 0,
  yenilenecek boolean,
  guncelleme timestamptz not null default now()
);
alter table public.avukat_paket enable row level security;
drop policy if exists "kendi paketini görür" on public.avukat_paket;
create policy "kendi paketini görür" on public.avukat_paket for select using (auth.uid() = kullanici_id);
drop policy if exists "yönetici paketleri görür" on public.avukat_paket;
create policy "yönetici paketleri görür" on public.avukat_paket for select using (public.yonetici_mi());
grant select on public.avukat_paket to authenticated;
grant select, insert, update, delete on public.avukat_paket to service_role;

create table if not exists public.avukat_kullanim (
  id bigserial primary key,
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  tur text not null,
  kredi integer not null,
  created_at timestamptz not null default now()
);
create index if not exists avukat_kullanim_kullanici on public.avukat_kullanim (kullanici_id, created_at desc);
alter table public.avukat_kullanim enable row level security;
drop policy if exists "kendi kullanımını görür" on public.avukat_kullanim;
create policy "kendi kullanımını görür" on public.avukat_kullanim for select using (auth.uid() = kullanici_id);
drop policy if exists "yönetici kullanımı görür" on public.avukat_kullanim;
create policy "yönetici kullanımı görür" on public.avukat_kullanim for select using (public.yonetici_mi());
grant select on public.avukat_kullanim to authenticated;
grant select, insert on public.avukat_kullanim to service_role;
grant usage on sequence public.avukat_kullanim_id_seq to service_role;

-- ---------- dönemi güncelle (iç işlev) ----------
create or replace function public.avukat_donem_cevir(p_kullanici uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_bas timestamptz; v_yeni timestamptz;
begin
  select donem_bas into v_bas from public.avukat_paket where kullanici_id = p_kullanici for update;
  if v_bas is null then return; end if;
  v_yeni := v_bas;
  while v_yeni + interval '1 month' <= now() loop v_yeni := v_yeni + interval '1 month'; end loop;
  if v_yeni <> v_bas then
    update public.avukat_paket set donem_bas = v_yeni, kullanilan = 0, guncelleme = now() where kullanici_id = p_kullanici;
  end if;
end; $$;
revoke all on function public.avukat_donem_cevir(uuid) from public, anon, authenticated;

-- ---------- kredi düş ----------
create or replace function public.avukat_kredi_dus(p_kullanici uuid, p_kredi integer, p_tur text)
returns integer language plpgsql security definer set search_path = public as $$
declare v public.avukat_paket;
begin
  perform public.avukat_donem_cevir(p_kullanici);
  select p.kullanici_id, p.bitis, p.kaynak, p.aylik_kredi, p.donem_bas, p.kullanilan, p.yenilenecek, p.guncelleme
    into v from public.avukat_paket p where p.kullanici_id = p_kullanici for update;
  if v.kullanici_id is null or v.bitis <= now() then raise exception 'paket yok'; end if;
  if v.aylik_kredi - v.kullanilan < p_kredi then raise exception 'kredi yok'; end if;
  update public.avukat_paket set kullanilan = kullanilan + p_kredi, guncelleme = now() where kullanici_id = p_kullanici;
  insert into public.avukat_kullanim (kullanici_id, tur, kredi) values (p_kullanici, coalesce(p_tur, 'evrak'), p_kredi);
  return v.aylik_kredi - v.kullanilan - p_kredi;
end; $$;
revoke all on function public.avukat_kredi_dus(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.avukat_kredi_dus(uuid, integer, text) to service_role;

-- ---------- kredi iade ----------
create or replace function public.avukat_kredi_iade(p_kullanici uuid, p_kredi integer, p_tur text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.avukat_paket set kullanilan = kullanilan - p_kredi, guncelleme = now() where kullanici_id = p_kullanici;
  if found then
    insert into public.avukat_kullanim (kullanici_id, tur, kredi) values (p_kullanici, 'iade ' || coalesce(p_tur, ''), -p_kredi);
  end if;
end; $$;
revoke all on function public.avukat_kredi_iade(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.avukat_kredi_iade(uuid, integer, text) to service_role;

-- ---------- ödeme bildirimi ----------
-- Yeni ya da süresi dolmuş pakette dönem bugünden başlar; süren pakette dönem ve kullanım korunur, yalnız bitiş değişir.
-- Elle verilmiş daha uzun bir paket, ödeme bildirimiyle kısalmaz.
create or replace function public.avukat_odeme(p_kullanici uuid, p_bitis timestamptz, p_kaynak text, p_yenilenecek boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_bitis timestamptz; v_kaynak text;
begin
  select bitis, kaynak into v_bitis, v_kaynak from public.avukat_paket where kullanici_id = p_kullanici for update;
  if v_bitis is null then
    insert into public.avukat_paket (kullanici_id, bitis, kaynak, donem_bas, kullanilan, yenilenecek)
    values (p_kullanici, p_bitis, coalesce(p_kaynak, 'revenuecat'), now(), 0, p_yenilenecek);
    return 'yeni';
  end if;
  if v_kaynak = 'manuel' and v_bitis > p_bitis then return 'manuel_korundu'; end if;
  if v_bitis <= now() and p_bitis > now() then
    update public.avukat_paket set bitis = p_bitis, kaynak = coalesce(p_kaynak, kaynak), donem_bas = now(), kullanilan = 0,
      yenilenecek = p_yenilenecek, guncelleme = now() where kullanici_id = p_kullanici;
    return 'yeniden';
  end if;
  update public.avukat_paket set bitis = p_bitis, kaynak = coalesce(p_kaynak, kaynak), yenilenecek = p_yenilenecek, guncelleme = now()
    where kullanici_id = p_kullanici;
  return 'guncellendi';
end; $$;
revoke all on function public.avukat_odeme(uuid, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.avukat_odeme(uuid, timestamptz, text, boolean) to service_role;

-- ---------- oyuncunun kendi durumu ----------
create or replace function public.avukat_durumum()
returns table (aktif boolean, bitis timestamptz, kaynak text, aylik integer, kalan integer, donem_sonu timestamptz, yenilenecek boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then return; end if;
  perform public.avukat_donem_cevir(auth.uid());
  return query
    select p.bitis > now(), p.bitis, p.kaynak, p.aylik_kredi, greatest(p.aylik_kredi - p.kullanilan, 0),
      least(p.donem_bas + interval '1 month', p.bitis), p.yenilenecek
    from public.avukat_paket p where p.kullanici_id = auth.uid();
end; $$;
revoke all on function public.avukat_durumum() from public, anon;
grant execute on function public.avukat_durumum() to authenticated;

-- ---------- yönetici: paket ver / kaldır ----------
create or replace function public.yonetici_avukat_paket(p_kullanici uuid, p_bitis timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_kaynak text;
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  select kaynak into v_kaynak from public.avukat_paket where kullanici_id = p_kullanici;
  if p_bitis is null then
    if v_kaynak is not null and v_kaynak <> 'manuel' then raise exception 'Ücretli paket buradan kaldırılamaz'; end if;
    delete from public.avukat_paket where kullanici_id = p_kullanici;
    insert into public.avukat_kullanim (kullanici_id, tur, kredi) select p_kullanici, 'yonetici kaldirdi', 0 where v_kaynak is not null;
    return 'kaldirildi';
  end if;
  if v_kaynak is not null and v_kaynak <> 'manuel' then raise exception 'Bu oyuncunun ücretli paketi var'; end if;
  insert into public.avukat_paket as a (kullanici_id, bitis, kaynak, donem_bas, kullanilan)
  values (p_kullanici, p_bitis, 'manuel', now(), 0)
  on conflict (kullanici_id) do update set bitis = p_bitis, kaynak = 'manuel', guncelleme = now();
  return 'verildi';
end; $$;
revoke all on function public.yonetici_avukat_paket(uuid, timestamptz) from public, anon;
grant execute on function public.yonetici_avukat_paket(uuid, timestamptz) to authenticated;

-- ---------- yönetici: ek kredi ----------
create or replace function public.yonetici_avukat_kredi(p_kullanici uuid, p_miktar integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_kalan integer;
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  if p_miktar is null or p_miktar = 0 or abs(p_miktar) > 1000 then raise exception 'Geçersiz miktar'; end if;
  perform public.avukat_donem_cevir(p_kullanici);
  update public.avukat_paket set kullanilan = kullanilan - p_miktar, guncelleme = now() where kullanici_id = p_kullanici
    returning aylik_kredi - kullanilan into v_kalan;
  if v_kalan is null then raise exception 'Bu oyuncunun avukat paketi yok'; end if;
  insert into public.avukat_kullanim (kullanici_id, tur, kredi) values (p_kullanici, 'yonetici', -p_miktar);
  return v_kalan;
end; $$;
revoke all on function public.yonetici_avukat_kredi(uuid, integer) from public, anon;
grant execute on function public.yonetici_avukat_kredi(uuid, integer) to authenticated;

-- ---------- yönetici: liste ----------
create or replace function public.yonetici_avukat_listesi()
returns table (kullanici_id uuid, bitis timestamptz, kaynak text, aylik integer, kalan integer, donem_sonu timestamptz, bu_ay integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  perform public.avukat_donem_cevir(p.kullanici_id) from public.avukat_paket p;
  return query
    select p.kullanici_id, p.bitis, p.kaynak, p.aylik_kredi, p.aylik_kredi - p.kullanilan,
      least(p.donem_bas + interval '1 month', p.bitis), p.kullanilan
    from public.avukat_paket p;
end; $$;
revoke all on function public.yonetici_avukat_listesi() from public, anon;
grant execute on function public.yonetici_avukat_listesi() to authenticated;
