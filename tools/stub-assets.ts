// Node'da görsel ve ses dosyaları (require("...webp")) yüklenemez: denetim araçları için boş modül sayılır.
// Bu dosya, src/ui/photos.ts'i dolaylı yükleyen bir modülden ÖNCE içe aktarılmalıdır.
const ext = (require as unknown as { extensions: Record<string, (m: { exports: unknown }) => void> }).extensions;
for (const e of [".webp", ".jpg", ".jpeg", ".png", ".mp3", ".m4a"]) ext[e] = m => { m.exports = 0; };
export {};
