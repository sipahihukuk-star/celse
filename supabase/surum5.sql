-- Celse · 5. kurulum: oyuncunun kendi hesabını uygulamanın içinden silebilmesi (App Store ve Google Play bunu ister).
-- Hesap silinince profil, kariyer, abonelik ve kurduğu eşleşmeler de silinir (tablolardaki "on delete cascade").
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create or replace function public.hesabimi_sil() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Önce giriş yapın'; end if;
  delete from auth.users where id = auth.uid();
end; $$;

revoke all on function public.hesabimi_sil() from public, anon;
grant execute on function public.hesabimi_sil() to authenticated;
