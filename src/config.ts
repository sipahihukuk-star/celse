// Sunucu ayarları. Supabase projesi kurulunca bu iki değer doldurulur (Supabase > Project Settings > API).
// Boş kaldıkça oyun tamamen cihazda çalışır: üyelik kapalıdır, serbest cevaplar anahtar kavramlarla puanlanır.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const serverReady = () => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
