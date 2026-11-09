//go:build windows

package main

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const (
	celseAdres = "https://celse.themiscode.com/?foy"
	runAnahtar = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	messageBoxW = user32.NewProc("MessageBoxW")
)

func mesaj(baslik, metin string, hata bool) {
	b, _ := syscall.UTF16PtrFromString(baslik)
	m, _ := syscall.UTF16PtrFromString(metin)
	tur := uintptr(0x40) // bilgi
	if hata {
		tur = 0x10
	}
	messageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(b)), tur)
}
func hataGoster(err error) { mesaj("Celse Klasör", "Bir sorun çıktı:\n\n"+err.Error(), true) }

func kurulumKlasoru() string { return filepath.Join(os.Getenv("LOCALAPPDATA"), "Celse") }
func varsayilanEvrak() string {
	if p := os.Getenv("USERPROFILE"); p != "" {
		return filepath.Join(p, "Documents", "Celse Evrak")
	}
	return filepath.Join(kurulumKlasoru(), "Celse Evrak")
}
func gizliCalistir(ad string, arg ...string) error {
	c := exec.Command(ad, arg...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return c.Run()
}
func klasorAc(yol string) { _ = exec.Command("explorer.exe", yol).Start() }
func tarayicidaAc(adres string) {
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", adres).Start()
}

func kopyala(kaynak, hedef string) error {
	if strings.EqualFold(filepath.Clean(kaynak), filepath.Clean(hedef)) {
		return nil
	}
	g, err := os.Open(kaynak)
	if err != nil {
		return err
	}
	defer g.Close()
	_ = os.Remove(hedef + ".eski")
	_ = os.Rename(hedef, hedef+".eski") // çalışan eski sürüm kilitliyse yanına alınır
	c, err := os.Create(hedef)
	if err != nil {
		return err
	}
	if _, err := io.Copy(c, g); err != nil {
		c.Close()
		return err
	}
	return c.Close()
}

const benioku = `CELSE EVRAK KLASÖRÜ

Bu klasöre konan evrakı (UDF, PDF, Word, fotoğraf, TIF, ZIP) Celse görür, okur ve esas / dosya numarasından
ilgili föye koyar. Evrak bu bilgisayardan çıkmaz.

DavaTek ile kullanım:
  DavaTek > Ayarlar > "Evrakların kaydedileceği klasör" olarak bu klasörü seçin.
  DavaTek'te "Tüm dosyaları çek" ile evrakı indirdiğinizde Celse bir sonraki açılışta (açıksa birkaç dakika içinde) alır.

UYAP'tan elle indirdiklerinizi de buraya kaydedebilirsiniz. Alt klasörler (dosya numarasıyla adlandırılmış) desteklenir.

Kaldırmak için: Ayarlar > Uygulamalar listesinde değil; "%LOCALAPPDATA%\Celse\CelseKlasor.exe --kaldir" çalıştırılır
ya da Celse > Föylerim > Evrak klasörü > "Masaüstü köprüsünü kaldır" bağlantısındaki adım izlenir.
`

func kur() error {
	kd := kurulumKlasoru()
	if err := os.MkdirAll(kd, 0o755); err != nil {
		return err
	}
	ben, err := os.Executable()
	if err != nil {
		return err
	}
	hedef := filepath.Join(kd, "CelseKlasor.exe")
	// Çalışan eski köprü durdurulur.
	_ = gizliCalistir("taskkill", "/F", "/IM", "CelseKlasor.exe")
	if err := kopyala(ben, hedef); err != nil {
		return errors.New("program kopyalanamadı: " + err.Error())
	}
	k := &Kopru{}
	if err := k.Yukle(filepath.Join(kd, "ayar.json"), varsayilanEvrak()); err != nil {
		return errors.New("Celse Evrak klasörü oluşturulamadı: " + err.Error())
	}
	_ = os.WriteFile(filepath.Join(k.Klasor(), "BENİ OKU - Celse.txt"), []byte(strings.ReplaceAll(benioku, "\n", "\r\n")), 0o644)
	// Windows açılınca kendiliğinden başlasın (yalnız bu kullanıcı için; yönetici izni gerekmez).
	if err := gizliCalistir("reg", "add", runAnahtar, "/v", "CelseKlasor", "/t", "REG_SZ", "/d", `"`+hedef+`"`, "/f"); err != nil {
		return errors.New("otomatik başlatma ayarlanamadı: " + err.Error())
	}
	// Masaüstüne Celse kısayolu.
	if p := os.Getenv("USERPROFILE"); p != "" {
		_ = os.WriteFile(filepath.Join(p, "Desktop", "Celse.url"), []byte("[InternetShortcut]\r\nURL="+celseAdres+"\r\n"), 0o644)
	}
	if err := exec.Command(hedef).Start(); err != nil {
		return errors.New("köprü başlatılamadı: " + err.Error())
	}
	mesaj("Celse Klasör kuruldu", "Kurulum tamamlandı.\n\nEvrak klasörünüz:\n"+k.Klasor()+
		"\n\nŞimdi DavaTek > Ayarlar'da evrak klasörü olarak bu klasörü seçin.\n\nCelse açılınca Föylerim > Evrak klasörü bölümünde \"Masaüstü köprüsü bağlı\" yazısını göreceksiniz. Tarayıcı \"bu cihazdaki uygulamalara erişim\" izni sorarsa İzin ver deyin.", false)
	klasorAc(k.Klasor())
	tarayicidaAc(celseAdres + "&klasor=kuruldu")
	return nil
}

func kaldir() error {
	_ = gizliCalistir("reg", "delete", runAnahtar, "/v", "CelseKlasor", "/f")
	if p := os.Getenv("USERPROFILE"); p != "" {
		_ = os.Remove(filepath.Join(p, "Desktop", "Celse.url"))
	}
	_ = gizliCalistir("taskkill", "/F", "/IM", "CelseKlasor.exe")
	mesaj("Celse Klasör", "Masaüstü köprüsü kaldırıldı. Celse Evrak klasörünüz ve içindeki evrak yerinde duruyor; isterseniz kendiniz silebilirsiniz.\n\nProgram dosyası: "+kurulumKlasoru(), false)
	return nil
}

func baslat(arg []string) error {
	if len(arg) > 0 && arg[0] == "--kaldir" {
		return kaldir()
	}
	ben, _ := os.Executable()
	kurulu := strings.EqualFold(filepath.Dir(filepath.Clean(ben)), filepath.Clean(kurulumKlasoru()))
	if !kurulu || (len(arg) > 0 && arg[0] == "--kur") {
		return kur()
	}
	k := &Kopru{}
	if err := k.Yukle(filepath.Join(kurulumKlasoru(), "ayar.json"), varsayilanEvrak()); err != nil {
		return err
	}
	if err := Calistir(k, klasorAc); err != nil {
		// Bağlantı noktası doluysa köprü zaten çalışıyordur.
		return nil
	}
	return nil
}
