// Web'de bu okuyucuya gerek yok: PDF, TIF ve fotoğraf doğrudan tarayıcıda okunur (src/ui/evrakOku.ts). Telefon sürümü: EvrakOkuyucu.native.tsx.
import { forwardRef } from "react";

export interface EvrakOkuyucuRef { oku: (ad: string, tur: "pdf" | "tif" | "resim", b64: string, ilerle: (m: string) => void) => Promise<string> }
export const EvrakOkuyucu = forwardRef<EvrakOkuyucuRef>(function EvrakOkuyucu() { return null; });
