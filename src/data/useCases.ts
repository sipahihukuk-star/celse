// Oyunun gördüğü davalar: uygulamayla gelen davalar + yönetim panelinden yayınlananlar.
// Panelde aynı kimlikle yayınlanan dava, uygulamayla gelenin yerine geçer.
import { useEffect, useState } from "react";
import { store, StoredCase, subscribe } from "../admin/store";
import { CaseFile } from "../engine/types";
import { useDavalar } from "./davalar";
import { useCaseHeads } from "../i18n/cases";

export function mergeCases(stored: StoredCase[], CASES: CaseFile[]): CaseFile[] {
  const published = new Map(stored.filter(s => s.status === "yayinda").map(s => [s.case.id, s.case]));
  const out = CASES.map(c => published.get(c.id) || c);
  published.forEach((c, id) => { if (!CASES.some(b => b.id === id)) out.push(c); });
  return out;
}

/** gecikme: yerleşik davaların arkadan yüklenmesi için bekleme (ms); oyun ekranlarında 0. */
export function useCases(gecikme = 0) {
  const CASES = useDavalar(gecikme);
  const [stored, setStored] = useState<StoredCase[]>([]);
  useEffect(() => {
    const load = () => { store.list().then(setStored).catch(() => {}); };
    load();
    return subscribe(load);
  }, []);
  // Seçili dilde çevirisi olan dosyaların başlığı ve özeti listelerde o dilde görünür (yalnız görüntü alanları).
  const headsT = useCaseHeads();
  const all = mergeCases(stored, CASES).map(c => headsT[c.id] ? { ...c, title: headsT[c.id].title || c.title, teaser: headsT[c.id].teaser || c.teaser } : c);
  // Tahkim dosyaları kendi bölümünde listelenir; karşılıklı duruşma listesinde yer almaz.
  return { all, career: all.filter(c => !c.career?.off), duel: all.filter(c => c.mode === "duel" && c.room !== "tahkim"), solo: all.filter(c => c.mode === "solo"), tahkim: all.filter(c => c.room === "tahkim"), stored };
}
