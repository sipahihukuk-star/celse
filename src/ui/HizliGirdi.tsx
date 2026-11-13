// Hızlı yazı kutusu: kutu kendi yazısını kendisi tutar (her harfte hiçbir şey yeniden çizilmez); değişiklik yazma durunca
// (varsayılan çeyrek saniye), Enter'da ya da kutudan çıkınca bir kez iletilir. Böylece uzun dilekçede ve binlerce föylük
// listede yazı akıcı kalır. Değer dışarıdan değişirse (Temizle, yapay zekânın yazdığı metin) kutu yeni değerle yenilenir.
import React, { useEffect, useRef, useState } from "react";
import { TextInput, TextInputProps } from "react-native";

export function HizliGirdi({ value, onChangeText, onSubmitEditing, onBlur, gecikme = 250, ...rest }: TextInputProps & { value: string; onChangeText: (v: string) => void; gecikme?: number }) {
  const son = useRef(value);
  const yazilan = useRef(value);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [surum, setSurum] = useState(0);
  // Dışarıdan gelen değişiklik (bizim ilettiğimiz değil): kutu yeni değerle baştan kurulur.
  useEffect(() => { if (value !== son.current) { son.current = value; yazilan.current = value; setSurum(x => x + 1); } }, [value]);
  useEffect(() => () => { if (zaman.current) clearTimeout(zaman.current); }, []);
  const cb = useRef(onChangeText); cb.current = onChangeText;
  const ilet = () => { if (zaman.current) { clearTimeout(zaman.current); zaman.current = null; } const x = yazilan.current; if (x !== son.current) { son.current = x; cb.current(x); } };
  return (
    <TextInput {...rest} key={surum} defaultValue={value}
      onChangeText={x => { yazilan.current = x; if (zaman.current) clearTimeout(zaman.current); zaman.current = setTimeout(ilet, gecikme); }}
      onSubmitEditing={e => { ilet(); onSubmitEditing?.(e); }}
      onBlur={e => { ilet(); onBlur?.(e); }} />
  );
}
