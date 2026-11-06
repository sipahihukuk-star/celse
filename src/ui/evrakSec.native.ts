// Telefonda evrak seçme: dosyalardan (UDF, Word, PDF, TIF, metin, fotoğraf) ya da kamerayla çekilen fotoğraf.
// Dosya önbelleğe kopyalanır ve bellekte okunur; hiçbir yere yüklenmez.
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";

export interface SecilenEvrak { ad: string; uri: string }

export async function dosyaSecTelefon(): Promise<SecilenEvrak[]> {
  const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: "*/*" });
  if (r.canceled || !r.assets) return [];
  return r.assets.map(a => ({ ad: a.name || "evrak", uri: a.uri }));
}

let sayac = 0;
export async function fotografCek(): Promise<SecilenEvrak | null> {
  const izin = await ImagePicker.requestCameraPermissionsAsync();
  if (!izin.granted) throw new Error("Kamera izni verilmedi. Ayarlardan Celse için kamerayı açabilirsiniz.");
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (r.canceled || !r.assets?.length) return null;
  sayac++;
  return { ad: `Evrak fotoğrafı ${sayac}.jpg`, uri: r.assets[0].uri };
}

export const baytlar = (uri: string) => new File(uri).bytes();
export const base64 = (uri: string) => new File(uri).base64();
export const TELEFON_SECIM = true;
