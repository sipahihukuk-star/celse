// Büro SQL kuralları gerçek Postgres (PGlite) üzerinde: npm i --no-save @electric-sql/pglite@0.2.17 && node tools/buro-sql-test.mjs supabase/surum18.sql
// Supabase auth şeması taklit edilir (auth.uid() = test.uid ayarı). Gerçek sunucuya bağlanılmaz.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const db = new PGlite();
await db.exec(`
create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(fs.readFileSync(process.argv[2], "utf8"));
await db.exec(fs.readFileSync(process.argv[2], "utf8")); // ikinci kez: zararsız olmalı
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c", X = "00000000-0000-0000-0000-0000000000ff";
for (const u of [A, B, C, X]) await db.query("insert into auth.users values ($1)", [u]);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("✗ " + m); } };
const as = async (u, sql, p = []) => { await db.exec("reset role"); await db.query("select set_config('test.uid', $1, false)", [u]); await db.exec("set role authenticated"); return db.query(sql, p); };
const hata = async (u, sql, p = []) => { try { await as(u, sql, p); return null; } catch (e) { return e.message; } };
const buro = (await as(A, "select public.buro_kur('Uydurma Hukuk', 'Av. A', 'iv', 'veri') as id")).rows[0].id;
ok(!!buro, "büro kuruldu");
ok(/Zaten/.test(await hata(A, "select public.buro_kur('İkinci', 'A', '', '')")), "ikinci büro kurulamaz");
await as(A, "insert into public.buro_davet (buro_id, kod_ozet, ad, unvan, yetki, tuz, iv, veri) values ($1, 'ozetB', 'B', 'Stajyer avukat', 'yaz', 't', 'i', 'v')", [buro]);
ok(/row-level|violates/.test(await hata(B, "insert into public.buro_davet (buro_id, kod_ozet, tuz, iv, veri) values ($1, 'x', 't', 'i', 'v')", [buro]) || ""), "üye olmayan davet açamaz");
ok((await as(X, "select count(1)::int as n from public.buro_davet")).rows[0].n === 0, "yabancı daveti göremez");
const kabul = (await as(B, "select public.buro_davet_kabul('ozetB', 'Stj. B') as j")).rows[0].j;
ok(kabul.buro_id === buro && kabul.veri === "v" && kabul.unvan === "Stajyer avukat", "davet kabul: " + JSON.stringify(kabul));
ok(/geçersiz/.test(await hata(C, "select public.buro_davet_kabul('ozetB', 'C')")), "davet tek kullanımlık");
ok((await as(B, "select count(1)::int as n from public.buro_uye")).rows[0].n === 2, "üye listesi görünür");
ok((await as(X, "select count(1)::int as n from public.buro_uye")).rows[0].n === 0, "yabancı üyeleri göremez");
// Föy yazma ve silme yetkisi
await as(B, "insert into public.buro_foy (buro_id, kayit_id, tur, iv, veri, guncelleme) values ($1, 'f1', 'foy', 'i', 'v', '1')", [buro]);
const r = (await as(A, "select yazan, veri from public.buro_foy where kayit_id = 'f1'")).rows[0];
ok(r && r.yazan === B, "yazan sunucuda konur");
ok(/silme yetkisi/.test(await hata(B, "update public.buro_foy set silindi = true where kayit_id = 'f1'") || ""), "stajyer silemez");
ok(!(await hata(A, "update public.buro_foy set silindi = true where kayit_id = 'f1'")), "yönetici siler");
ok((await as(X, "select count(1)::int as n from public.buro_foy")).rows[0].n === 0, "yabancı föy göremez");
ok(/row-level|violates/.test(await hata(X, "insert into public.buro_foy (buro_id, kayit_id, tur) values ($1, 'z', 'foy')", [buro]) || ""), "yabancı föy yazamaz");
// Ünvan / yetki
ok(/yalnız büro yöneticisi/.test(await hata(B, "update public.buro_uye set yetki = 'yonetici' where kullanici_id = $1", [B]) || ""), "kendi yetkisini yükseltemez");
ok(!(await hata(B, "update public.buro_uye set anahtar_iv = 'x', anahtar_veri = 'y', ad = 'B2' where kullanici_id = $1", [B])), "kendi anahtarını yazar");
ok(!(await hata(A, "update public.buro_uye set unvan = 'Avukat', yetki = 'sil' where kullanici_id = $1", [B])), "yönetici ünvan değiştirir");
ok(/yalnız çalışanın kendisi/.test(await hata(A, "update public.buro_uye set anahtar_veri = 'kötü' where kullanici_id = $1", [B]) || ""), "yönetici başkasının anahtarına yazamaz");
ok(/yönetici kalır/.test(await hata(A, "update public.buro_uye set yetki = 'sil' where kullanici_id = $1", [A]) || ""), "kurucu yönetici kalır");
await as(B, "update public.buro_foy set silindi = false where kayit_id = 'f1'");
ok(!(await hata(B, "update public.buro_foy set silindi = true where kayit_id = 'f1'")), "avukat (sil) siler");
const n0 = (await as(B, "delete from public.buro_uye where kullanici_id = $1 returning 1", [A])).rows.length;
ok(n0 === 0, "kurucu çıkarılamaz");
await as(A, "delete from public.buro_uye where kullanici_id = $1", [B]);
ok((await as(B, "select count(1)::int as n from public.buro_foy")).rows[0].n === 0, "çıkarılan çalışan föyleri göremez");
ok((await as(B, "select count(1)::int as n from public.buro_uye")).rows[0].n === 0, "çıkarılan üyeleri göremez");
await db.exec("reset role"); await db.query("select set_config('test.uid', '', false)"); await db.exec("set role anon");
ok(/permission denied/.test(await db.query("select 1 from public.buro_foy").then(() => "", e => e.message)), "anon erişemez");
if (fail) { console.log("buro-sql: " + fail + " hata"); process.exit(1); }
console.log("buro-sql: tamam");
