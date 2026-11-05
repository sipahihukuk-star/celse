// Yerel değişiklik bildirimi: büro, dosya akışı ya da karakter kaydedilince eşitleme (sync.ts) haberdar olur.
// Ayrı dosyadır; office/flow/character eşitlemeyi içe aktarmadan haber verebilsin (döngüsel bağımlılık olmasın).
type Listener = (owner: string) => void;
const listeners = new Set<Listener>();

/** owner: kaydın yazıldığı hesabın kimliği (misafirde boş; misafir kaydı eşitlenmez). */
export function markChanged(owner: string | undefined | null) {
  if (!owner) return;
  listeners.forEach(f => { try { f(owner); } catch { /* yok say */ } });
}

export function onLocalChange(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; }
