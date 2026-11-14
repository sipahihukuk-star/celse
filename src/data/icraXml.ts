// UYAP Avukat Portal "İcra Takip Açılış – XML" için dosya üretimi. Yapı, Adalet Bakanlığı e-Takip programındaki exchange.dtd'ye
// (sürüm 1.1) göre kurulur; kodlar aynı programın KodluBilgilerData.xml dosyasından ve 18.12.2015 mahiyet kodu duyurusundan alınmıştır:
//  - takipTuru: 0 ilamlı, 1 ilamsız
//  - takipYolu (ilamsız): 0 genel haciz, 1 iflas, 2 rehnin paraya çevrilmesi, 3 kambiyo, 4 kiralanan taşınmazın tahliyesi
//    (ilamlı): 0 para ve teminattan başka borçlar, 1 para ve teminat, 2 diğer, 3 rehnin paraya çevrilmesi
//  - takipSekli (yol içindeki örnek): genel haciz 0 = Örnek 7; kambiyo 0 = Örnek 10; kira 0 = Örnek 14, 1 = Örnek 13;
//    rehin 0 = Örnek 9 (ipotek), 1 = Örnek 8 (taşınır); ilamlı para 0 = Örnek 4-5, 1 = Örnek 6
//  - faizTipKod: FAIZT00002 adi kanuni (yasal), FAIZT00007 reeskont avans, FAIZT00011 en yüksek mevduat (TL), FAIZT00003 diğer
//  - tutarTur: PRBRMTL / PRBRMUSD / PRBRMEUR / PRBRMGBP; adresTuru: ADRTR00001 ikametgâh, ADRTR00002 işyeri
// Taraf rol kodları (rolID) ve alacak kalemi kodları programda yok (sunucudan gelir); yerine adları yazılır.
// Tarih biçimi GG/AA/YYYY, tutar biçimi 15000.00 kabul edilmiştir. İlk yüklemede UYAP'ın hata mesajına göre düzeltilecek.
import type { Foy } from "./foy";
import { AVANS, IcraBilgi, icraHesapla, MAHIYETLER, ParaBirimi, talepEdilenHak, tumBorclular, TTK1530, YASAL } from "./icra";
import { IL_ILCE } from "./ilIlce";

export interface VekilBilgi { adSoyad: string; tcKimlikNo?: string; baroNo?: string; tbbNo?: string; adres?: string }

const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r?\n/g, " ");
const nit = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
const tarih = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : undefined);
const tutar = (x?: number) => (x === undefined ? undefined : (Math.round(x * 100) / 100).toFixed(2));
const PB: Record<ParaBirimi, [string, string]> = { TL: ["PRBRMTL", "TL - Türk Lirası"], USD: ["PRBRMUSD", "USD - Amerikan Doları"], EUR: ["PRBRMEUR", "EUR - Euro"], GBP: ["PRBRMGBP", "GBP - İngiliz Sterlini"] };
/** Sabit oran yazılmamış dönemsel faizde (yasal, avans, TTK 1530) takip tarihindeki oran: UYAP'ta faiz satırında oran boş kalmasın. */
const tabloOrani = (tur: string, gun?: string): string | undefined => {
  const tb = tur === "yasal" ? YASAL : tur === "avans" ? AVANS : tur === "ttk1530" ? TTK1530 : undefined;
  const g = (gun || new Date().toISOString()).slice(0, 10);
  const o = tb ? [...tb].reverse().find(([b]) => b <= g)?.[1] : undefined;
  return o !== undefined ? String(o) : undefined;
};
const FAIZ_KOD: Record<string, [string, string]> = { yasal: ["FAIZT00002", "Adi Kanuni Faiz"], avans: ["FAIZT00007", "Reeskont Avans"], mevduat: ["FAIZT00011", "En Yüksek Mevduat Faizi(TL)"], sozlesme: ["FAIZT00003", "Diğer"], ttk1530: ["FAIZT00003", "TTK 1530. Madde Temerrüt Faizi"] };

/** Takip türü / yolu / şekli. */
export function takipKodlari(b: IcraBilgi): { takipTuru: number; takipYolu: number; takipSekli: number } {
  switch (b.yol) {
    case "ilamli": return { takipTuru: 0, takipYolu: 1, takipSekli: 0 };
    case "kambiyo": return { takipTuru: 1, takipYolu: 3, takipSekli: 0 };
    case "kira": return { takipTuru: 1, takipYolu: 4, takipSekli: 1 };
    case "ipotek": return { takipTuru: 1, takipYolu: 2, takipSekli: 0 };
    case "tasinir_rehni": return { takipTuru: 1, takipYolu: 2, takipSekli: 1 };
    default: return { takipTuru: 1, takipYolu: 0, takipSekli: 0 };
  }
}

// Türkçe harfler JavaScript'te \\b sözcük sınırı sayılmadığı için sınırlar elle yazılır ("A.Ş." sonunda nokta da olabilir).
const KURUM = /(?:^|[\s(,])(A\.?\s?Ş\.?|ANONİM|LTD\.?|LİMİTED|ŞTİ\.?|ŞİRKETİ|KOOPERATİF|VAKFI|DERNEĞİ|BANKASI|BAŞKANLIĞI|MÜDÜRLÜĞÜ|BAKANLIĞI|BELEDİYESİ|BELEDİYE|ÜNİVERSİTESİ|HAZİNE|HAZİNESİ|SİGORTA|HOLDİNG|T\.A\.O\.?|BİRLİĞİ|ODASI)(?=$|[\s.,)])/u;
const ust = (x: string) => x.toLocaleUpperCase("tr");

/** Adres metninden il ve ilçe kodu (ör. "… Karşıyaka / İZMİR"). */
export function adresKodu(adres?: string): { ilKodu?: number; il?: string; ilceKodu?: number; ilce?: string } {
  if (!adres) return {};
  const u = " " + ust(adres).replace(/[/,.;:()-]/g, " ").replace(/\s+/g, " ") + " ";
  // Sondan başa: adresin sonunda yazan il önceliklidir.
  let bul: (typeof IL_ILCE)[number] | undefined, yer = -1;
  for (const x of IL_ILCE) { const i = u.lastIndexOf(" " + x[1] + " "); if (i > yer) { yer = i; bul = x; } }
  if (!bul) return {};
  let ilce: [number, string] | undefined, iy = -1;
  for (const y of bul[2]) { if (y[1] === "MERKEZ") continue; const i = u.lastIndexOf(" " + y[1] + " "); if (i > iy) { iy = i; ilce = y; } }
  return { ilKodu: bul[0], il: bul[1], ilceKodu: ilce?.[0], ilce: ilce?.[1] };
}

function kisiKurum(ad: string, kimlik?: string, adres?: string, mernis?: boolean): string {
  const temiz = ad.replace(/\s+/g, " ").trim();
  const no = (kimlik || "").replace(/\D/g, "");
  const kurum = KURUM.test(ust(temiz)) || no.length === 10;
  let ic: string;
  if (kurum) ic = `<kurum${nit({ kurumAdi: temiz, vergiNo: no.length === 10 ? no : undefined, kamuOzel: /BAŞKANLIĞI|MÜDÜRLÜĞÜ|BAKANLIĞI|BELEDİYE|HAZİNE|ÜNİVERSİTESİ/.test(ust(temiz)) ? "K" : "O" })}/>`;
  else {
    const p = temiz.split(" ");
    const soyadi = p.length > 1 ? p.pop()! : "";
    ic = `<kisiTumBilgileri${nit({ adi: p.join(" "), soyadi, tcKimlikNo: no.length === 11 ? no : undefined })}/>`;
  }
  const a = mernis ? "" : adres ? (() => { const k = adresKodu(adres); return `<adres${nit({ adresTuru: kurum ? "ADRTR00002" : "ADRTR00001", adresTuruAciklama: kurum ? "Yurt İçi İşyeri Adresi" : "Yurt İçi İkametgah Adresi", ilKodu: k.ilKodu, il: k.il, ilce: k.ilce, ilceKodu: k.ilceKodu, adres })}/>`; })() : "";
  return `<kisiKurumBilgileri${nit({ ad: temiz })}>${ic}${a}</kisiKurumBilgileri>`;
}

/** Föyün icra bilgilerinden UYAP takip açılış XML'i. */
export function uyapXml(f: Foy, b: IcraBilgi, vekil: VekilBilgi, bugun = new Date().toISOString().slice(0, 10)): string {
  const h = icraHesapla(b, bugun);
  const pb = b.paraBirimi || "TL";
  const [tt, ta] = PB[pb];
  const takip = b.takipTarihi || bugun;
  const kod = takipKodlari(b);
  const m = f.muvekkilBilgi || {}, k = f.karsiBilgi || {};
  const t: string[] = [];
  let n = 0;
  t.push(`<taraf id="t${++n}">${kisiKurum(f.muvekkil, m.kimlikNo, m.adres, b.mernisAlacakli)}<rolTur Rol="Alacaklı"/></taraf>`);
  for (const x of f.ekMuvekkiller || []) if (x.ad.trim()) t.push(`<taraf id="t${++n}">${kisiKurum(x.ad, x.kimlikNo, x.adres)}<rolTur Rol="Alacaklı"/></taraf>`);
  const tb = tumBorclular(f, b);
  if (!tb.length) t.push(`<taraf id="t${++n}">${kisiKurum(f.karsiTaraf, k.kimlikNo, k.adres, b.mernisBorclu)}<rolTur Rol="Borçlu"/></taraf>`);
  for (const x of tb) t.push(`<taraf id="t${++n}">${kisiKurum(x.ad, x.kimlikNo, x.adres, x.mernis)}<rolTur Rol="Borçlu"/></taraf>`);
  // Vekil
  const vp = vekil.adSoyad.replace(/^av\.?\s*/i, "").trim().split(/\s+/);
  const vSoy = vp.length > 1 ? vp.pop()! : "";
  const vAd = vp.join(" ");
  const vAdr = vekil.adres ? (() => { const a = adresKodu(vekil.adres); return `<adres${nit({ adresTuru: "ADRTR00002", adresTuruAciklama: "Yurt İçi İşyeri Adresi", ilKodu: a.ilKodu, il: a.il, ilce: a.ilce, ilceKodu: a.ilceKodu, adres: vekil.adres })}/>`; })() : "";
  const vekilXml = `<VekilKisi id="v1"><vekil${nit({ adi: vAd, soyadi: vSoy, tcKimlikNo: vekil.tcKimlikNo, baroNo: vekil.baroNo, tbbNo: vekil.tbbNo, vekilTipi: "B", kurumAvukatiMi: "H", borcluVekiliMi: "H" })}/><kisiTumBilgileri${nit({ adi: vAd, soyadi: vSoy, tcKimlikNo: vekil.tcKimlikNo })}/>${vAdr}</VekilKisi>`;
  // Alacak kalemleri
  const kalemXml = h.kalemler.filter(x => x.k.tutar).map((x, i) => {
    const tur = x.k.faizTuru || "yasal";
    const fk = FAIZ_KOD[tur];
    const faiz = tur !== "yok" && fk ? `<faiz${nit({ id: `f${i + 1}`, baslangicTarihi: tarih(x.k.faizBaslangic), bitisTarihi: tarih(takip), faizOran: x.k.oran !== undefined ? String(x.k.oran) : tabloOrani(tur, takip), faizTipKod: fk[0], faizTipKodAciklama: fk[1], faizTutar: tutar(x.faiz), faizTutarTur: tt, faizTutarTurAdi: ta, faizSureTip: "SRBRM00003" })}/>` : "";
    return `<alacakKalemi${nit({ id: `k${i + 1}`, alacakKalemAdi: x.k.ad, alacakKalemKodAciklama: x.k.ad, alacakKalemTutar: tutar(x.k.tutar), alacakKalemIlkTutar: tutar(x.k.tutar), tutarTur: tt, tutarAdi: ta, dovizKurCevrimi: pb !== "TL" && b.kur ? String(b.kur) : undefined })}>${faiz}</alacakKalemi>`;
  });
  const ekXml = [...h.ek, ...(b.masraflar || []).filter(x => x.tutar).map(x => ({ ad: x.ad || "Masraf", tutar: x.tutar }))]
    .map((x, i) => `<alacakKalemi${nit({ id: `e${i + 1}`, alacakKalemAdi: x.ad, alacakKalemKodAciklama: x.ad, alacakKalemTutar: tutar(x.tutar), alacakKalemIlkTutar: tutar(x.tutar), tutarTur: tt, tutarAdi: ta })}/>`);
  const kalemler = [...kalemXml, ...ekXml].join("");
  const yilSira = (x?: string) => { const mm = (x || "").match(/((?:19|20)\d{2})\s*\/\s*(\d+)/); return mm ? [mm[1], mm[2]] : [undefined, undefined]; };
  let alacak: string;
  if (b.yol === "ilamli") {
    const [dy, ds] = yilSira(b.ilam?.esasNo), [ky, ks] = yilSira(b.ilam?.kararNo);
    alacak = `<ilam${nit({ id: "i1", ilamiVerenMahkeme: b.ilam?.mahkeme, ilamDosyaNoYil: dy, ilamDosyaSira: ds, ilamKararNoYil: ky, ilamKararSira: ks, ilamTarihi: tarih(b.ilam?.kararTarihi), kesinlesmeTarih: tarih(b.ilam?.kesinlesme), ilamAciklama: b.ilam?.dosyaTuru })}>${kalemler}</ilam>`;
  } else if (b.yol === "kambiyo") {
    const sn = b.senet || {};
    if (sn.tur === "cek") alacak = `<cek${nit({ id: "c1", seriNo: sn.seriNo, kesideTarihi: tarih(sn.duzenleme), ibrazTarihi: tarih(sn.vade), tutar: tutar(h.kalemler[0]?.k.tutar), tutarTur: tt, tutarTurAciklama: ta, bankaAdi: sn.banka })}>${kalemler}</cek>`;
    else if (sn.tur === "police") alacak = `<police${nit({ id: "p1", kesideTarihi: tarih(sn.duzenleme), vadeTarihi: tarih(sn.vade), belgeninTutari: tutar(h.kalemler[0]?.k.tutar), tutarTur: tt, tutarAdi: ta, kesideciAdSoyad: sn.kesideci })}>${kalemler}</police>`;
    else alacak = `<senet${nit({ id: "s1", tanzimTarihi: tarih(sn.duzenleme), vadeTarihi: tarih(sn.vade), belgeninTutari: tutar(h.kalemler[0]?.k.tutar), tutarTur: tt, tutarAdi: ta })}>${kalemler}</senet>`;
  } else if (b.yol === "kira") {
    const kr = b.kira || {};
    const a = adresKodu(kr.adres);
    alacak = `<kontratKefil id="kk1"><kontrat${nit({ id: "ko1", sozlesmeSozluBelgeli: "B", hazirlanisTarihi: tarih(kr.sozlesmeTarihi), gecerlilikBaslangicTarihi: tarih(kr.sozlesmeTarihi), belgeninTutari: tutar(kr.aylikKira), tutarTur: tt, tutarTurAciklama: ta, aciklama: kr.aylar ? "Takibe konu aylar: " + kr.aylar : undefined, adresAciklama: kr.adres })}>${kalemler}</kontrat>${kr.adres ? `<adres${nit({ adresTuru: "ADRTR00001", ilKodu: a.ilKodu, il: a.il, ilce: a.ilce, ilceKodu: a.ilceKodu, adres: kr.adres })}/>` : ""}</kontratKefil>`;
  } else {
    alacak = `<digerAlacak${nit({ id: "da1", digerAlacakAciklama: b.belge || "Alacak", tarih: tarih(h.kalemler[0]?.k.faizBaslangic), tutar: tutar(h.asil), tutarTur: tt, tutarAdi: ta })}>${kalemler}</digerAlacak>`;
  }
  const talep = b.talep === "tahliye" ? "TAHLİYE" : b.talep === "haciz_tahliye" ? "HACİZ VE TAHLİYE" : b.yol === "ipotek" || b.yol === "tasinir_rehni" ? "REHNİN PARAYA ÇEVRİLMESİ" : "HACİZ";
  const mah = MAHIYETLER.find(x => x.kod === b.mahiyet);
  const dosya = `<dosya${nit({ id: "d1", dosyaTipi: "Genel İcra Dairesi", dosyaTuru: "0", takipTuru: kod.takipTuru, takipYolu: kod.takipYolu, takipSekli: kod.takipSekli,
    alacaklininTalepEttigiHak: talepEdilenHak(b, bugun), BK84MaddeUygulansin: b.tbk100 !== false ? "E" : "H", BSMVUygulansin: b.bsmv ? "E" : "H", KKDFUygulansin: b.kkdf ? "E" : "H",
    aciklama48e9: talep, dosyaBelirleyicisi: ("CELSE-" + (f.esasNo || f.id)).slice(0, 60), mahiyetKodu: mah?.kod })}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<exchangeData>\n<exchangeHeader versiyon="1.1"/>\n<dosyalar>\n${dosya}\n${t.join("\n")}\n${vekilXml}\n${alacak}\n</dosya>\n</dosyalar>\n</exchangeData>\n`;
}

/** XML üretmeden önce eksik vekil bilgisi. */
export function vekilEksik(v: VekilBilgi): string[] {
  const e: string[] = [];
  if (!v.adSoyad.trim()) e.push("Vekilin adı soyadı");
  if (!(v.tcKimlikNo || "").replace(/\D/g, "").match(/^\d{11}$/)) e.push("Vekilin T.C. kimlik no'su");
  if (!v.baroNo) e.push("Vekilin baro sicil no'su");
  return e;
}
