-- Celse · 11. kurulum: "Derdini anlat" için "Duruşmayı izle" (görsel, eğitim amaçlı canlandırma; hukuki görüş değildir).
-- - danismalar.senaryo: danisma fonksiyonunun "izle" işleminin ürettiği sahne senaryosu (JSON metni). Aynı kredinin içindedir,
--   bir kez üretilir. Dört sahne: görüşme (kullanıcının avukatı), görüşme (karşı taraf), duruşma, karar (eğitim amaçlı).
--   Yazma yalnız service role ile yapılır (surum8.sql'deki yetkiler aynen geçerlidir); oyuncu kendi satırını okur ve siler.
-- - danismalar.ses_yolu: aynı senaryonun tek parça MP3 kaydının yolu ("ses" işlemi). Dosya özel "danisma-ses" deposunda,
--   kullanıcının klasöründe (kullanıcı kimliği / danışma kimliği .mp3) durur; indirme süreli imzalı adresle yapılır.
-- - Oyuncu kendi klasöründeki ses dosyasını silebilir (danışmasını silerken uygulama önce dosyayı siler).
-- Supabase > SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.
-- Not: yapıştırırken bozulmasın diye bu dosyada yıldız karakteri yoktur; açıklamalar yalnız -- ile yazılır.

alter table public.danismalar add column if not exists senaryo text;

-- Çok büyük bir metin yazılamasın (fonksiyon zaten kısaltır; bu yalnız bir güvenlik sınırıdır).
alter table public.danismalar drop constraint if exists danismalar_senaryo_boy;
alter table public.danismalar add constraint danismalar_senaryo_boy check (senaryo is null or length(senaryo) <= 120000);

alter table public.danismalar add column if not exists ses_yolu text;

-- ---------- özel ses deposu ----------
insert into storage.buckets (id, name, public) values ('danisma-ses', 'danisma-ses', false) on conflict (id) do nothing;
update storage.buckets set public = false where id = 'danisma-ses';

-- Oyuncu yalnız kendi klasörünü görür ve silebilir (Supabase'de dosya silmek için görme izni de gerekir).
-- Yazma yalnız service role ile yapılır; indirme fonksiyonun verdiği süreli imzalı adresle olur.
drop policy if exists "kendi danışma sesini görür" on storage.objects;
create policy "kendi danışma sesini görür" on storage.objects for select to authenticated
  using (bucket_id = 'danisma-ses' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists "kendi danışma sesini siler" on storage.objects;
create policy "kendi danışma sesini siler" on storage.objects for delete to authenticated
  using (bucket_id = 'danisma-ses' and split_part(name, '/', 1) = auth.uid()::text);
