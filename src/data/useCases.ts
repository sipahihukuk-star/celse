// Oyunun gördüğü davalar: uygulamayla gelen davalar + yönetim panelinden yayınlananlar.
// Panelde aynı kimlikle yayınlanan dava, uygulamayla gelenin yerine geçer.
import { useEffect, useState } from "react";
import { store, StoredCase, subscribe } from "../admin/store";
import { CaseFile } from "../engine/types";
import { CASES } from "./cases";

export function mergeCases(stored: StoredCase[]): CaseFile[] {
  const published = new Map(stored.filter(s => s.status === "yayinda").map(s => [s.case.id, s.case]));
  const out = CASES.map(c => published.get(c.id) || c);
  published.forEach((c, id) => { if (!CASES.some(b => b.id === id)) out.push(c); });
  return out;
}

export function useCases() {
  const [stored, setStored] = useState<StoredCase[]>([]);
  useEffect(() => {
    const load = () => { store.list().then(setStored).catch(() => {}); };
    load();
    return subscribe(load);
  }, []);
  const all = mergeCases(stored);
  return { all, duel: all.filter(c => c.mode === "duel"), solo: all.filter(c => c.mode === "solo"), stored };
}
