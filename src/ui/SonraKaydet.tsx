// Yazarken değil, kutudan çıkınca (ya da Enter'da) kaydeden metin kutusu: tutar, telefon gibi alanlar yarım yazılmışken
// kaydedilip föyü karıştırmasın. Telefonda ve tarayıcıda aynı çalışır (onBlur + onSubmitEditing).
import React, { useEffect, useState } from "react";
import { StyleProp, TextInput, TextStyle } from "react-native";
import { C } from "./theme";

export function SonraKaydet({ deger, onKaydet, placeholder, style }: { deger: string; onKaydet: (v: string) => void; placeholder?: string; style?: StyleProp<TextStyle> }) {
  const [v, setV] = useState(deger);
  useEffect(() => { setV(deger); }, [deger]);
  const bitir = () => { if (v !== deger) onKaydet(v); };
  return <TextInput value={v} onChangeText={setV} onBlur={bitir} onSubmitEditing={bitir} placeholder={placeholder} placeholderTextColor={C.muted} style={style} />;
}
