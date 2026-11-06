// Web'de dosya seçme EvrakScreen içindeki dosya penceresiyle yapılır; telefon sürümü evrakSec.native.ts.
export interface SecilenEvrak { ad: string; uri: string }
export async function dosyaSecTelefon(): Promise<SecilenEvrak[]> { return []; }
export async function fotografCek(): Promise<SecilenEvrak | null> { return null; }
export async function baytlar(_uri: string): Promise<Uint8Array> { return new Uint8Array(); }
export async function base64(_uri: string): Promise<string> { return ""; }
export const TELEFON_SECIM = false;
