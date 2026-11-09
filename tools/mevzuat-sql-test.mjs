// Mevzuat arşivi (surum21.sql) gerçek Postgres (PGlite) üzerinde: npm i --no-save @electric-sql/pglite@0.2.17 && node tools/mevzuat-sql-test.mjs
// Türkçe kök araması, kısaltmayla madde, mülga süzgeci, okuma yetkisi, yazma yasağı (uydurma metinlerle).
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
const R = new URL("../supabase/", import.meta.url).pathname;
const db = new PGlite();
await db.exec(`
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated; grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to authenticated, anon;
`);
await db.exec(fs.readFileSync(R + "surum21.sql", "utf8"));
await db.exec(fs.readFileSync(R + "surum21.sql", "utf8"));
await db.exec("grant select on public.mevzuat_kanun, public.mevzuat_madde, public.hukuk_onbellek to authenticated; grant insert on public.mevzuat_madde to authenticated");
await db.exec(`insert into public.mevzuat_kanun (slug, no, ad, durum) values ('6100-hmk', '6100', 'HUKUK MUHAKEMELERİ KANUNU', 'yururlukte'), ('1086-humk', '1086', 'HUKUK USULÜ MUHAKEMELERİ KANUNU', 'mulga');
insert into public.mevzuat_madde (slug, sira, madde, baslik, metin) values
 ('6100-hmk', 1, '281', 'Bilirkişi raporuna itiraz', '(1) Taraflar, bilirkişi raporunun tebliğinden itibaren iki hafta içinde itiraz edebilirler.'),
 ('6100-hmk', 2, 'Geçici 1', null, 'Geçiş hükümleri uygulanır.'),
 ('1086-humk', 1, '286', 'Bilirkişi', 'Bilirkişinin raporuna itirazlar dinlenir.');`);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("✗ " + m); } };
const as = async (sql, p = []) => { await db.exec("reset role"); await db.query("select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', false)"); await db.exec("set role authenticated"); return db.query(sql, p); };
let r = await as("select madde, ad from public.mevzuat_ara($1, 10, false)", ["bilirkişi raporlarına itirazı"]);
ok(r.rows.length === 1 && r.rows[0].madde === "281", "Türkçe kök, yalnız yürürlükte: " + JSON.stringify(r.rows));
r = await as("select madde from public.mevzuat_ara($1, 10, true)", ["bilirkişi itiraz"]);
ok(r.rows.length === 2, "mülga dahil: " + r.rows.length);
r = await as("select madde, metin from public.mevzuat_madde_getir('6100', 'geçici 1')");
ok(r.rows.length === 1 && /Geçiş/.test(r.rows[0].metin), "madde getir (büyük-küçük harf)");
r = await as("select kanun, mulga, madde from public.mevzuat_durumu()");
ok(r.rows[0].kanun === 1 && r.rows[0].mulga === 1 && Number(r.rows[0].madde) === 3, "durum: " + JSON.stringify(r.rows[0]));
let hata = ""; try { await as("insert into public.mevzuat_madde (slug, sira, madde, metin) values ('6100-hmk', 9, '9', 'x')"); } catch (e) { hata = e.message; }
ok(/row-level|policy|permission denied/i.test(hata), "kullanıcı arşive yazamaz: " + hata);
r = await as("select count(1)::int as n from public.hukuk_onbellek");
ok(r.rows[0].n === 0, "önbellek okunamaz (kural yok)");
if (fail) { console.log(`mevzuat-sql-test: ${fail} hata`); process.exit(1); }
console.log("mevzuat-sql-test: tamam");
