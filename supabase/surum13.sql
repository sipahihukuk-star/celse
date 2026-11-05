-- Celse · 13. kurulum: "Derdini anlat" olayını uygulamadaki avukat oyunculara oynatma (eğitim amaçlı; hukuki görüş değildir).
-- - danismalar.kabul_zaman: kullanıcının, değerlendirmenin ve canlandırmanın yapay zekâ ürünü olduğunu, hata yapabileceğini ve gerçek
--   bir mahkeme kararı ya da hukuki görüş olmadığını bildiğini kabul ettiği an (danisma fonksiyonu yazar).
-- - danisma_dosyalari: danışmadan üretilen anonim, tek kişilik oynanabilir dava dosyası (oyunun CaseFile şeması, jsonb).
--   durum: bekliyor (oyuncu bekliyor) · oynaniyor (bir oyuncu aldı) · oynandi (kayıt hazır). Bir danışmaya bir dosya.
--   Dosyayı yalnız danisma fonksiyonu (service role) ekler. Dosya sahibi yalnız kendi satırlarını okur; oynayanın üye kimliği
--   (oynayan_id) sahibe hiç gösterilmez, yalnız takma adı (oynayan) ve oyun kaydı (kayit) gösterilir. Danışma silinince dosya da silinir.
-- - danisma_dosya_listesi(): giriş yapmış oyuncuya bekleyen dosyaları listeler (dosya sahibinin kimliği olmadan; kendi dosyaları hariç).
-- - danisma_dosya_al(p_id, p_kabul): oyuncu, kaydının dosya sahibine gösterileceği uyarısını kabul ederek dosyayı alır; dosya döner.
--   Alınmış ama 6 saattir bitirilmemiş dosya yeniden alınabilir.
-- - danisma_dosya_birak(p_id): oyuncu yarıda çıkarsa dosya yeniden "bekliyor" olur.
-- - danisma_dosya_bitir(p_id, p_kayit): oyun kaydını yazar, dosyayı "oynandi" yapar ve dosya sahibinin gelen kutusuna mesaj bırakır.
-- Supabase > SQL Editor'de bir kez çalıştırılır (surum8, surum9 ve surum11'den sonra). Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

alter table public.danismalar add column if not exists kabul_zaman timestamptz;

-- ---------- dosyalar ----------
create table if not exists public.danisma_dosyalari (
  id uuid primary key default gen_random_uuid(),
  danisma_id uuid not null references public.danismalar (id) on delete cascade,
  sahip_id uuid not null references auth.users (id) on delete cascade,
  dosya jsonb not null,
  durum text not null default 'bekliyor',
  oynayan text,
  oynayan_id uuid references auth.users (id) on delete set null,
  kayit jsonb,
  alindi_at timestamptz,
  oynandi_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.danisma_dosyalari drop constraint if exists danisma_dosyalari_durum_check;
alter table public.danisma_dosyalari add constraint danisma_dosyalari_durum_check check (durum in ('bekliyor', 'oynaniyor', 'oynandi'));
alter table public.danisma_dosyalari drop constraint if exists danisma_dosyalari_boy;
alter table public.danisma_dosyalari add constraint danisma_dosyalari_boy
  check (length(dosya::text) <= 200000 and (kayit is null or length(kayit::text) <= 200000));
create unique index if not exists danisma_dosyalari_danisma on public.danisma_dosyalari (danisma_id);
create index if not exists danisma_dosyalari_durum on public.danisma_dosyalari (durum, created_at);
create index if not exists danisma_dosyalari_sahip on public.danisma_dosyalari (sahip_id, created_at desc);

alter table public.danisma_dosyalari enable row level security;
drop policy if exists "kendi danışma dosyasını görür" on public.danisma_dosyalari;
create policy "kendi danışma dosyasını görür" on public.danisma_dosyalari for select using (auth.uid() = sahip_id);
-- insert, update ve delete ilkesi yok: yazma yalnız aşağıdaki işlevlerle ya da service role ile yapılır.
revoke all on public.danisma_dosyalari from anon, authenticated;
-- Sütun yetkisi: dosya sahibi oynayanın üye kimliğini (oynayan_id) okuyamaz.
grant select (id, danisma_id, sahip_id, dosya, durum, oynayan, kayit, alindi_at, oynandi_at, created_at) on public.danisma_dosyalari to authenticated;
grant select, insert, update, delete on public.danisma_dosyalari to service_role;

-- Oyuncunun takma adı: üye kimliğinden türetilir (ad ve e-posta kullanılmaz); aynı oyuncu hep aynı takma adı taşır.
create or replace function public.danisma_takma_ad(p_kullanici uuid) returns text
language sql immutable as $$
  select 'Av. Oyuncu ' || upper(substr(md5('celse-oyuncu:' || p_kullanici::text), 1, 4));
$$;

-- ---------- oyuncu: bekleyen dosyalar ----------
create or replace function public.danisma_dosya_listesi()
returns table (id uuid, baslik text, alan text, mahkeme text, ozet text, durum text, benim boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  return query
    select f.id, f.dosya ->> 'title', f.dosya ->> 'area', f.dosya ->> 'court', f.dosya ->> 'teaser',
           case when f.durum = 'oynaniyor' and f.oynayan_id = auth.uid() then 'oynaniyor' else 'bekliyor' end,
           (f.oynayan_id = auth.uid()), f.created_at
    from public.danisma_dosyalari f
    where f.sahip_id <> auth.uid()
      and (f.durum = 'bekliyor'
        or (f.durum = 'oynaniyor' and (f.oynayan_id = auth.uid() or f.alindi_at < now() - interval '6 hours')))
    order by f.created_at
    limit 100;
end; $$;

-- ---------- oyuncu: dosyayı al ----------
-- p_kabul: oyuncu, oyun kaydının (seçimleri, cevapları, takma adı) dosya sahibine gösterileceğini kabul etti. Dönüş: dosya (jsonb).
create or replace function public.danisma_dosya_al(p_id uuid, p_kabul boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dosya jsonb;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  if not coalesce(p_kabul, false) then raise exception 'kabul gerekli'; end if;
  update public.danisma_dosyalari f
    set durum = 'oynaniyor', oynayan_id = auth.uid(), oynayan = public.danisma_takma_ad(auth.uid()), alindi_at = now()
    where f.id = p_id and f.sahip_id <> auth.uid()
      and (f.durum = 'bekliyor'
        or (f.durum = 'oynaniyor' and (f.oynayan_id = auth.uid() or f.alindi_at < now() - interval '6 hours')))
    returning f.dosya into v_dosya;
  if v_dosya is null then raise exception 'dosya alınamadı'; end if;
  return v_dosya;
end; $$;

-- ---------- oyuncu: yarıda bırak ----------
create or replace function public.danisma_dosya_birak(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.danisma_dosyalari
    set durum = 'bekliyor', oynayan_id = null, oynayan = null, alindi_at = null
    where id = p_id and durum = 'oynaniyor' and oynayan_id = auth.uid();
  return found;
end; $$;

-- ---------- oyuncu: bitir, kaydı yaz, sahibine haber ver ----------
-- p_kayit: tutanak satırları, seçimler, puan ve sonuç (uygulama yazar). Dönüş: gelen kutusuna bırakılan mesajın kimliği.
create or replace function public.danisma_dosya_bitir(p_id uuid, p_kayit jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sahip uuid;
  v_ad text;
  v_baslik text;
  v_mesaj uuid;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  if p_kayit is null or jsonb_typeof(p_kayit) <> 'object' or length(p_kayit::text) > 200000 then raise exception 'geçersiz kayıt'; end if;
  v_ad := public.danisma_takma_ad(auth.uid());
  update public.danisma_dosyalari
    set durum = 'oynandi', kayit = p_kayit || jsonb_build_object('oynayan', v_ad), oynayan = v_ad, oynandi_at = now()
    where id = p_id and durum = 'oynaniyor' and oynayan_id = auth.uid()
    returning sahip_id, dosya ->> 'title' into v_sahip, v_baslik;
  if v_sahip is null then raise exception 'dosya bulunamadı'; end if;
  -- E-posta bildirimi: src/data/inbox.ts içindeki e-posta kancası (TODO) kurulunca bu mesaj e-postayla da gönderilecek.
  insert into public.mesajlar (kullanici_id, baslik, metin, tur)
  values (v_sahip, 'Danışma dosyanız oynandı',
    'Derdini anlat bölümünde gönderdiğiniz olay (' || coalesce(v_baslik, 'danışma dosyası') || '), uygulamadaki bir avukat oyuncu ('
      || v_ad || ') tarafından oynandı. Oyuncu kaydını Derdini anlat > Geçmiş bölümünden izleyebilirsiniz. Eğitim amaçlı canlandırmadır, hukuki görüş değildir; oyuncular gerçek avukat olmayabilir.',
    'sistem')
  returning id into v_mesaj;
  return v_mesaj;
end; $$;

-- ---------- yetkiler ----------
revoke all on function public.danisma_takma_ad(uuid) from public, anon;
grant execute on function public.danisma_takma_ad(uuid) to authenticated, service_role;
revoke all on function public.danisma_dosya_listesi() from public, anon;
grant execute on function public.danisma_dosya_listesi() to authenticated;
revoke all on function public.danisma_dosya_al(uuid, boolean) from public, anon;
grant execute on function public.danisma_dosya_al(uuid, boolean) to authenticated;
revoke all on function public.danisma_dosya_birak(uuid) from public, anon;
grant execute on function public.danisma_dosya_birak(uuid) to authenticated;
revoke all on function public.danisma_dosya_bitir(uuid, jsonb) from public, anon;
grant execute on function public.danisma_dosya_bitir(uuid, jsonb) to authenticated;
