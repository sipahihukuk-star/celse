-- Celse · 10. kurulum: "Derdini anlat" olaylarının anonim örnek dosya olarak kullanılması için isteğe bağlı muvafakat.
-- - danismalar.ornek_izni: kullanıcı, olayının kişisel bilgilerden arındırılarak eğitim amaçlı dava dosyası hazırlanmasında
--   kullanılmasına izin verdiyse true. Kullanıcı danışmasını silerse satır ve izin birlikte silinir.
-- - admin_ornek_danismalar(): yalnız yöneticiye, izin verilmiş danışmaları listeler (kullanıcı kimliği olmadan).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

alter table public.danismalar add column if not exists ornek_izni boolean not null default false;

create or replace function public.admin_ornek_danismalar(p_sinir integer default 200)
returns table (id uuid, alan text, olay text, deliller text, karsi text, talep text, degerlendirme text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.yonetici_mi() then raise exception 'Yetki yok'; end if;
  return query
    select d.id, d.alan, d.olay, d.deliller, d.karsi, d.talep, d.degerlendirme, d.created_at
    from public.danismalar d
    where d.ornek_izni and d.durum <> 'bekliyor'
    order by d.created_at desc
    limit greatest(1, least(coalesce(p_sinir, 200), 1000));
end; $$;
revoke all on function public.admin_ornek_danismalar(integer) from public, anon;
grant execute on function public.admin_ornek_danismalar(integer) to authenticated;
