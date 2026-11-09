-- Celse · 20. kurulum: Büronun asıl evrak dosyaları (PDF, UDF, fotoğraf) büro bulutunda.
-- - buro-evrak: herkese kapalı depolama kovası. Dosyalar avukatın cihazında büro anahtarıyla şifrelenip yüklenir; sunucu açamaz.
--   Dosya yolu: <büro kimliği>/<evrak kimliği>. Şahsi dosyalar hiç yüklenmez.
-- - Yalnız o büronun çalışanları okur; föy yazabilen ünvanlar (yönetici, avukat, stajyer, katip, sekreter…) yükler ve siler.
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

insert into storage.buckets (id, name, public, file_size_limit)
values ('buro-evrak', 'buro-evrak', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- Dosya yolunun ilk parçası büro kimliğidir; çağıranın o bürodaki yetkisi (üye değilse null).
create or replace function public.buro_dosya_yetkim(p_ad text) returns text
language sql stable security definer set search_path = public as $$
  select u.yetki from public.buro_uye u where u.kullanici_id = auth.uid() and u.buro_id::text = split_part(p_ad, '/', 1)
$$;
grant execute on function public.buro_dosya_yetkim(text) to authenticated;

drop policy if exists buro_evrak_oku on storage.objects;
create policy buro_evrak_oku on storage.objects for select to authenticated
  using (bucket_id = 'buro-evrak' and public.buro_dosya_yetkim(name) is not null);
drop policy if exists buro_evrak_yukle on storage.objects;
create policy buro_evrak_yukle on storage.objects for insert to authenticated
  with check (bucket_id = 'buro-evrak' and public.buro_dosya_yetkim(name) in ('yonetici', 'sil', 'yaz'));
drop policy if exists buro_evrak_degistir on storage.objects;
create policy buro_evrak_degistir on storage.objects for update to authenticated
  using (bucket_id = 'buro-evrak' and public.buro_dosya_yetkim(name) in ('yonetici', 'sil', 'yaz'))
  with check (bucket_id = 'buro-evrak' and public.buro_dosya_yetkim(name) in ('yonetici', 'sil', 'yaz'));
drop policy if exists buro_evrak_sil on storage.objects;
create policy buro_evrak_sil on storage.objects for delete to authenticated
  using (bucket_id = 'buro-evrak' and public.buro_dosya_yetkim(name) in ('yonetici', 'sil', 'yaz'));
