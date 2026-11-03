// Üyelik ekranı: üye ol / giriş yap (sunucu) ya da bu cihazdaki oyuncular (sunucu ayarlı değilken).
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { kbBar } from "./KeyboardBar";
import { Account, deleteLocal, deleteServerAccount, localProfiles, resetPassword, signIn, signOut, signUp, supabase, switchLocal, useAccount } from "../data/account";
import { KVKK_BASLIK, KVKK_METNI } from "../legal/kvkk";
import { Btn } from "./kit";
import { C, F } from "./theme";
import { t } from "../i18n";

type Tab = "kayit" | "giris" | "liste";

export default function AccountScreen({ onBack, onDone, initial }: { onBack: () => void; onDone: () => void; initial?: "giris" | "kayit" }) {
  const server = !!supabase();
  const { account } = useAccount();
  // Sunucu varken önce giriş açılır (üyeler çoğunlukta); yeni oyuncu "Üye ol" sekmesine geçer.
  const [tab, setTab] = useState<Tab>(server ? initial || "giris" : "liste");
  const [profiles, setProfiles] = useState<Account[]>([]);
  useEffect(() => { if (!server) localProfiles().then(ps => { setProfiles(ps); if (!ps.length) setTab("kayit"); }); }, [account]);

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Btn kind="ghost" label={t("‹ Giriş")} onPress={onBack} />
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.eyebrow}>{server ? t("ÜYELİK") : t("BU CİHAZDAKİ OYUNCULAR")}</Text>
          <Text style={s.title}>{tab === "giris" ? t("Giriş yap") : tab === "kayit" ? t("Üye ol") : t("Oyuncunuzu seçin")}</Text>
          <Text style={s.sub}>{server ? t("Kariyeriniz hesabınıza kaydedilir; her cihazda kaldığınız yerden devam edersiniz.") : t("Her oyuncunun kariyeri ayrı tutulur. Sunucu bağlandığında gerçek üyelik açılacak.")}</Text>
        </View>
      </View>

      {server && account && <SignedIn account={account} onBack={onBack} />}

      <View style={s.tabs}>
        {(server ? [["giris", t("Giriş yap")], ["kayit", t("Üye ol")]] : [["liste", t("Oyuncular")], ["kayit", t("Yeni oyuncu")]]).map(([k, l]) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k as Tab)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "liste" && (
        <View style={{ gap: 10 }}>
          {profiles.map(p => (
            <View key={p.id} style={[s.card, account?.id === p.id && s.cardOn]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName}>{p.adSoyad}</Text>
                <Text style={s.cardSub} numberOfLines={1}>{p.eposta} · {p.telefon}</Text>
              </View>
              <Btn label={account?.id === p.id ? t("Devam et") : t("Bu oyuncuyla oyna")} onPress={async () => { await switchLocal(p.id); onDone(); }} />
              <ConfirmDelete onConfirm={async () => { await deleteLocal(p.id); setProfiles(await localProfiles()); }} />
            </View>
          ))}
          {!profiles.length && <Text style={s.sub}>{t('Bu cihazda henüz oyuncu yok. "Yeni oyuncu" sekmesinden ekleyin.')}</Text>}
        </View>
      )}
      {tab === "kayit" && <SignUpForm server={server} onDone={onDone} />}
      {tab === "giris" && <SignInForm onDone={onDone} />}
    </ScrollView>
  );
}

/** Oturum açıkken: kim olduğu, çıkış ve hesabı kalıcı silme (mağazaların istediği hesap silme imkânı). */
function SignedIn({ account, onBack }: { account: Account; onBack: () => void }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <View style={[s.card, s.cardOn, { flexDirection: "column", alignItems: "stretch" }]}>
      <Text style={s.cardName}>{t("Oturum açık: {ad}", { ad: account.adSoyad })}</Text>
      <Text style={s.cardSub}>{account.eposta}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        <Btn kind="ghost" label={t("Çıkış yap")} onPress={async () => { await signOut(); onBack(); }} />
        {!ask ? <Btn kind="ghost" label={t("Hesabımı sil")} onPress={() => setAsk(true)} /> : (
          <>
            <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setAsk(false)} />
            <Btn label={busy ? t("Siliniyor…") : t("Evet, hesabımı ve kariyerimi kalıcı olarak sil")} disabled={busy} onPress={async () => {
              setBusy(true); setErr("");
              const r = await deleteServerAccount();
              setBusy(false);
              if (r.error) setErr(t(r.error)); else onBack();
            }} />
          </>
        )}
      </View>
      {ask && <Text style={s.cardSub}>{t("Üyeliğiniz, kariyeriniz, büronuz ve kayıtlı sonuçlarınız kalıcı olarak silinir; bu işlem geri alınamaz.")}</Text>}
      {!!err && <Text style={[s.cardSub, { color: C.bad }]}>{err}</Text>}
    </View>
  );
}

function ConfirmDelete({ onConfirm }: { onConfirm: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Btn kind="ghost" label={t("Vazgeç")} onPress={() => setAsk(false)} />
      <Btn kind="ghost" label={t("Oyuncuyu ve kariyerini sil")} onPress={onConfirm} />
    </View>
  ) : <Btn kind="ghost" label={t("Sil")} onPress={() => setAsk(true)} />;
}

function Input(props: { label: string; value: string; onChange: (v: string) => void; type?: "email" | "phone" | "password" | "name"; placeholder?: string }) {
  const ty = props.type;
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput {...kbBar} value={props.value} onChangeText={props.onChange} placeholder={props.placeholder} placeholderTextColor={C.muted} style={s.input}
        secureTextEntry={ty === "password"} autoCapitalize={ty === "name" ? "words" : "none"} autoCorrect={false}
        keyboardType={ty === "email" ? "email-address" : ty === "phone" ? "phone-pad" : "default"}
        autoComplete={ty === "email" ? "email" : ty === "phone" ? "tel" : ty === "password" ? "password" : ty === "name" ? "name" : "off"}
        textContentType={ty === "email" ? "emailAddress" : ty === "phone" ? "telephoneNumber" : ty === "password" ? "password" : ty === "name" ? "name" : "none"} />
    </View>
  );
}

function SignUpForm({ server, onDone }: { server: boolean; onDone: () => void }) {
  const [v, setV] = useState({ adSoyad: "", telefon: "", eposta: "", sifre: "", kvkk: false });
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);
  const up = (k: keyof typeof v) => (x: any) => setV(o => ({ ...o, [k]: x }));
  const submit = async () => {
    setBusy(true); setMsg(null);
    const r = await signUp(v);
    setBusy(false);
    if (r.error) return setMsg({ t: t(r.error) });
    if (r.needsConfirm) return setMsg({ t: t("Hesabınız oluşturuldu. E-posta adresinize gönderilen bağlantıyla doğrulayıp giriş yapın."), ok: true });
    onDone();
  };
  return (
    <View style={s.form}>
      <Input label={t("Ad soyad")} value={v.adSoyad} onChange={up("adSoyad")} type="name" placeholder={t("Ad Soyad")} />
      <Input label={t("Telefon")} value={v.telefon} onChange={up("telefon")} type="phone" placeholder={t("05xx xxx xx xx · +49 …")} />
      <Input label={t("E-posta")} value={v.eposta} onChange={up("eposta")} type="email" placeholder={t("ornek@eposta.com")} />
      {server && <Input label={t("Şifre (en az 8 karakter)")} value={v.sifre} onChange={up("sifre")} type="password" />}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: v.kvkk }} onPress={() => up("kvkk")(!v.kvkk)} style={s.check}>
        <View style={[s.box, v.kvkk && s.boxOn]}>{v.kvkk && <Text style={s.tick}>✓</Text>}</View>
        <Text style={s.checkText}>
          <Text style={s.link} onPress={() => setShowKvkk(true)}>{t("Aydınlatma metnini")}</Text>{t(" okudum; kişisel verilerimin bu metinde belirtilen amaçlarla işlenmesi hakkında bilgilendirildim.")}
        </Text>
      </Pressable>
      {!!msg && <Text style={[s.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}
      <Btn label={busy ? t("Kaydediliyor…") : server ? t("Üye ol") : t("Oyuncuyu oluştur")} onPress={submit} disabled={busy} />
      <KvkkModal visible={showKvkk} onClose={() => setShowKvkk(false)} />
    </View>
  );
}

function SignInForm({ onDone }: { onDone: () => void }) {
  const [e, setE] = useState(""), [p, setP] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={s.form}>
      <Input label={t("E-posta")} value={e} onChange={setE} type="email" />
      <Input label={t("Şifre")} value={p} onChange={setP} type="password" />
      {!!msg && <Text style={[s.msg, msg.ok && { color: C.good }]}>{msg.t}</Text>}
      <Btn label={busy ? t("Giriş yapılıyor…") : t("Giriş yap")} disabled={busy} onPress={async () => {
        setBusy(true); const r = await signIn(e, p); setBusy(false);
        if (r.error) setMsg({ t: t(r.error) }); else onDone();
      }} />
      <Pressable accessibilityRole="button" onPress={async () => {
        if (!e.trim()) return setMsg({ t: t("Önce e-posta adresinizi yazın.") });
        const r = await resetPassword(e);
        setMsg(r.error ? { t: t(r.error) } : { t: t("Şifre yenileme bağlantısı e-posta adresinize gönderildi."), ok: true });
      }}>
        <Text style={s.linkSmall}>{t("Şifremi unuttum")}</Text>
      </Pressable>
    </View>
  );
}

export function KvkkModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.sheetTitle}>{KVKK_BASLIK}</Text>
          <ScrollView style={{ maxHeight: 440 }}>
            {KVKK_METNI.map((p, i) => <Text key={i} style={s.sheetP}>{p}</Text>)}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}><Btn kind="ghostInk" label={t("Kapat")} onPress={onClose} /></View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 14 },
  eyebrow: { fontFamily: F.mono, fontSize: 12, letterSpacing: 2.5, color: C.muted },
  title: { fontFamily: F.display, fontSize: 32, color: C.brass },
  sub: { fontFamily: F.body, fontSize: 15, color: C.textSoft, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.brass, borderColor: C.brass },
  tabText: { fontFamily: F.bodyMed, fontSize: 15, color: C.text },
  tabTextOn: { color: C.brassInk, fontFamily: F.bodyBold },
  form: { gap: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 16 },
  label: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: C.muted, textTransform: "uppercase" },
  input: { fontFamily: F.body, fontSize: 17, color: C.text, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  check: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: C.brassDim, alignItems: "center", justifyContent: "center", marginTop: 2 },
  boxOn: { backgroundColor: C.brass, borderColor: C.brass },
  tick: { color: C.brassInk, fontFamily: F.bodyBold, fontSize: 14 },
  checkText: { flex: 1, fontFamily: F.body, fontSize: 15, color: C.textSoft },
  link: { color: C.brass, textDecorationLine: "underline" },
  linkSmall: { fontFamily: F.body, fontSize: 14, color: C.brass, textDecorationLine: "underline", alignSelf: "flex-start" },
  msg: { fontFamily: F.bodyMed, fontSize: 15, color: C.bad },
  card: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14 },
  cardOn: { borderColor: C.brass },
  cardName: { fontFamily: F.displayMed, fontSize: 20, color: C.text },
  cardSub: { fontFamily: F.body, fontSize: 14, color: C.muted },
  overlay: { flex: 1, backgroundColor: "rgba(5,8,10,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.paper, borderRadius: 4, padding: 22, width: "100%", maxWidth: 620 },
  sheetTitle: { fontFamily: F.display, fontSize: 22, color: C.ink, marginBottom: 10 },
  sheetP: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink, marginBottom: 10 }
});
