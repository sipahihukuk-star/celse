-- Celse · 7. kurulum: uygulama içi satın alma (RevenueCat).
-- - abonelikler: RevenueCat ürün, mağaza, ortam ve yenileme bilgisi sütunları; kaynak listesine 'test_store' ve 'revenuecat'.
-- - derdini_kredi: "Derdini anlat" kredisi (tüketilebilir ürünler: celse_derdini_anlat_1 → 1, _3 → 3 kredi).
-- - odeme_olaylari: işlenen RevenueCat olayları (aynı olay iki kez gelirse ikincisi yok sayılır).
-- - odeme_olayi_isle(): ödeme bildirimi fonksiyonunun (supabase/functions/odeme) çağırdığı tek işlem; yalnız service role çalıştırır.
-- Oyuncu kendi abonelik ve kredi satırını yalnızca okur; yazma yalnız service role (ödeme bildirimi) ve yöneticiye (abonelikte 'manuel').
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

/* ---------- abonelikler ---------- */
alter table public.abonelikler add column if not exists urun text;
alter table public.abonelikler add column if not exists ortam text;
alter table public.abonelikler add column if not exists yenilenecek boolean;
alter table public.abonelikler add column if not exists son_olay text;
alter table public.abonelikler add column if not exists olay_zamani timestamptz;
alter table public.abonelikler drop constraint if exists abonelikler_kaynak_check;
alter table public.abonelikler add constraint abonelikler_kaynak_check
  check (kaynak in ('app_store', 'google_play', 'iyzico', 'manuel', 'test_store', 'revenuecat'));
-- (Okuma ilkesi "kendi aboneliğini görür" ve yönetici ilkesi schema.sql / surum3.sql'de; yeniden yazılır.)
alter table public.abonelikler enable row level security;
drop policy if exists "kendi aboneliğini görür" on public.abonelikler;
create policy "kendi aboneliğini görür" on public.abonelikler for select using (auth.uid() = kullanici_id);

/* ---------- Derdini anlat kredisi ---------- */
create table if not exists public.derdini_kredi (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  kredi integer not null default 0 check (kredi >= 0),
  toplam_alinan integer not null default 0,
  guncelleme timestamptz not null default now()
);
alter table public.derdini_kredi enable row level security;
drop policy if exists "kendi kredisini görür" on public.derdini_kredi;
create policy "kendi kredisini görür" on public.derdini_kredi for select using (auth.uid() = kullanici_id);
drop policy if exists "yönetici krediyi görür" on public.derdini_kredi;
create policy "yönetici krediyi görür" on public.derdini_kredi for select using (public.yonetici_mi());
-- insert / update / delete ilkesi yok: yalnız service role (RLS'yi aşar) yazar.
grant select on public.derdini_kredi to authenticated;

/* ---------- işlenen ödeme olayları ---------- */
create table if not exists public.odeme_olaylari (
  olay_id text primary key,
  tur text not null,
  kullanici_id uuid references auth.users (id) on delete set null,
  urun text,
  magaza text,
  ortam text,
  sonuc text,
  ham jsonb,
  zaman timestamptz not null default now()
);
create index if not exists odeme_olaylari_kullanici on public.odeme_olaylari (kullanici_id, zaman desc);
alter table public.odeme_olaylari enable row level security;
drop policy if exists "yönetici ödeme olaylarını görür" on public.odeme_olaylari;
create policy "yönetici ödeme olaylarını görür" on public.odeme_olaylari for select using (public.yonetici_mi());

/* ---------- ödeme olayını işle (tek işlem, tekrar güvenli) ----------
   p_tur: RevenueCat olay türü. p_kredi: tüketilebilir üründe eklenecek (+) ya da iadede düşülecek (−) kredi; abonelikte 0.
   p_bitis: aboneliğin bitişi (RevenueCat expiration_at_ms); abonelik olayı değilse null.
   Dönüş: 'tekrar' (bu olay daha önce işlendi), 'kredi', 'abonelik' ya da 'kayit' (yalnız kaydedildi). */
create or replace function public.odeme_olayi_isle(
  p_olay_id text, p_tur text, p_kullanici uuid, p_urun text, p_kaynak text, p_ortam text,
  p_bitis timestamptz, p_yenilenecek boolean, p_kredi integer, p_ham jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  eski public.abonelikler%rowtype;
  v_sonuc text := 'kayit';
  v_var boolean := p_kullanici is not null and exists (select 1 from auth.users where id = p_kullanici);
begin
  insert into public.odeme_olaylari (olay_id, tur, kullanici_id, urun, magaza, ortam, ham)
  values (p_olay_id, p_tur, case when v_var then p_kullanici end, p_urun, p_kaynak, p_ortam, p_ham)
  on conflict (olay_id) do nothing;
  if not found then return 'tekrar'; end if;

  -- Hesap silinmişse (ya da hiç yoksa) yalnız olay kaydı kalır (kimlik ham olayda durur).
  if not v_var then
    update public.odeme_olaylari set sonuc = 'kullanici_yok' where olay_id = p_olay_id;
    return 'kayit';
  end if;

  if coalesce(p_kredi, 0) <> 0 then
    insert into public.derdini_kredi as d (kullanici_id, kredi, toplam_alinan, guncelleme)
    values (p_kullanici, greatest(p_kredi, 0), greatest(p_kredi, 0), now())
    on conflict (kullanici_id) do update
      set kredi = greatest(d.kredi + p_kredi, 0),
          toplam_alinan = d.toplam_alinan + greatest(p_kredi, 0),
          guncelleme = now();
    v_sonuc := 'kredi';
  elsif p_bitis is not null then
    select * into eski from public.abonelikler where kullanici_id = p_kullanici for update;
    -- Yöneticinin elle verdiği ve daha geç biten abonelik, mağaza olayıyla kısaltılmaz.
    if found and eski.kaynak = 'manuel' and eski.bitis > p_bitis then
      v_sonuc := 'manuel_korundu';
    else
      insert into public.abonelikler as a (kullanici_id, bitis, kaynak, urun, ortam, yenilenecek, son_olay, olay_zamani, guncelleme)
      values (p_kullanici, p_bitis, p_kaynak, p_urun, p_ortam, p_yenilenecek, p_tur, now(), now())
      on conflict (kullanici_id) do update
        set bitis = excluded.bitis, kaynak = excluded.kaynak, urun = coalesce(excluded.urun, a.urun), ortam = excluded.ortam,
            yenilenecek = excluded.yenilenecek, son_olay = excluded.son_olay, olay_zamani = now(), guncelleme = now();
      v_sonuc := 'abonelik';
    end if;
  end if;

  update public.odeme_olaylari set sonuc = v_sonuc where olay_id = p_olay_id;
  return v_sonuc;
end; $$;

revoke all on function public.odeme_olayi_isle(text, text, uuid, text, text, text, timestamptz, boolean, integer, jsonb) from public, anon, authenticated;
grant execute on function public.odeme_olayi_isle(text, text, uuid, text, text, text, timestamptz, boolean, integer, jsonb) to service_role;
