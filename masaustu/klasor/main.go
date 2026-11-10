// Celse Klasör: Windows'ta arka planda çalışan küçük köprü. Avukatın "Belgeler\Celse Evrak" klasörünü (DavaTek'in evrak
// indirdiği klasör) yalnız bu bilgisayarın içinden (127.0.0.1) Celse'ye açar: Celse açıkken yeni evrakı görür, okur ve föyüne
// koyar. Hiçbir dosya internete gönderilmez; köprü yalnız celse.themiscode.com sayfasının isteklerine cevap verir (tarayıcının
// gönderdiği Origin başlığı denetlenir) ve yalnız seçilen klasörün içindeki dosyaları okur.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	Surum = "1.0.0"
	Port  = 47613
)

// Celse sayfaları (yayındaki site ve geliştirme sunucuları).
var izinliKaynak = map[string]bool{
	"https://celse.themiscode.com": true,
	"http://localhost:8766":        true,
	"http://localhost:8081":        true,
	"http://127.0.0.1:8766":        true,
}

// Celse'nin okuyabildiği evrak türleri (src/engine/mask/readers.ts turBul ile aynı).
var uzantilar = map[string]bool{".udf": true, ".docx": true, ".doc": true, ".txt": true, ".text": true, ".rtf": true, ".odt": true, ".htm": true, ".html": true,
	".pdf": true, ".tif": true, ".tiff": true, ".jpg": true, ".jpeg": true, ".png": true, ".zip": true}

type Ayar struct {
	Klasor string `json:"klasor"`
}

type Kopru struct {
	mu       sync.Mutex
	ayarYolu string
	ayar     Ayar
}

func (k *Kopru) Klasor() string { k.mu.Lock(); defer k.mu.Unlock(); return k.ayar.Klasor }

func (k *Kopru) Yukle(ayarYolu, varsayilan string) error {
	k.ayarYolu = ayarYolu
	b, err := os.ReadFile(ayarYolu)
	if err == nil {
		_ = json.Unmarshal(b, &k.ayar)
	}
	if k.ayar.Klasor == "" {
		k.ayar.Klasor = varsayilan
	}
	if err := os.MkdirAll(k.ayar.Klasor, 0o755); err != nil {
		return err
	}
	// Bu alt klasöre konan dosyalar föye değil, Celse'deki dilekçe örneklerine gider.
	_ = os.MkdirAll(filepath.Join(k.ayar.Klasor, "Dilekçe örnekleri"), 0o755)
	return nil
}

func (k *Kopru) KlasorDegistir(yol string) error {
	yol = filepath.Clean(strings.TrimSpace(yol))
	if !filepath.IsAbs(yol) {
		return errors.New("klasör yolu tam olmalı (örn. C:\\Users\\Ad\\Documents\\Celse Evrak)")
	}
	st, err := os.Stat(yol)
	if err != nil || !st.IsDir() {
		return errors.New("klasör bulunamadı")
	}
	k.mu.Lock()
	k.ayar.Klasor = yol
	k.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(k.ayarYolu), 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(k.ayar, "", "  ")
	return os.WriteFile(k.ayarYolu, b, 0o600)
}

type Dosya struct {
	Yol     string `json:"yol"`
	Boyut   int64  `json:"boyut"`
	Degisim int64  `json:"degisim"`
}

// Liste: klasördeki evrak dosyaları (alt klasörler dahil, en çok 8 kat, en çok 20.000 dosya), yeniden eskiye.
func Liste(kok string) ([]Dosya, error) {
	var xs []Dosya
	kok = filepath.Clean(kok)
	err := filepath.WalkDir(kok, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(kok, p)
		if d.IsDir() {
			if rel != "." && (strings.HasPrefix(d.Name(), ".") || strings.Count(rel, string(filepath.Separator)) >= 8) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasPrefix(d.Name(), "~$") || strings.HasPrefix(d.Name(), ".") || !uzantilar[strings.ToLower(filepath.Ext(d.Name()))] {
			return nil
		}
		bilgi, err := d.Info()
		if err != nil || !bilgi.Mode().IsRegular() {
			return nil
		}
		xs = append(xs, Dosya{Yol: filepath.ToSlash(rel), Boyut: bilgi.Size(), Degisim: bilgi.ModTime().UnixMilli()})
		if len(xs) >= 20000 {
			return filepath.SkipAll
		}
		return nil
	})
	sort.Slice(xs, func(i, j int) bool { return xs[i].Degisim > xs[j].Degisim })
	return xs, err
}

// GuvenliYol: istenen göreli yol klasörün içinde kalmalı (../ ile dışarı çıkılamaz, tam yol verilemez).
func GuvenliYol(kok, rel string) (string, error) {
	if rel == "" || strings.ContainsRune(rel, 0) || filepath.IsAbs(rel) || strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") || filepath.VolumeName(rel) != "" {
		return "", errors.New("geçersiz yol")
	}
	kok = filepath.Clean(kok)
	tam := filepath.Clean(filepath.Join(kok, filepath.FromSlash(rel)))
	r, err := filepath.Rel(kok, tam)
	if err != nil || r == ".." || strings.HasPrefix(r, ".."+string(filepath.Separator)) || r == "." {
		return "", errors.New("klasör dışı yol")
	}
	// Sembolik bağla dışarı çıkılmasın.
	if gercek, err := filepath.EvalSymlinks(tam); err == nil {
		gk, _ := filepath.EvalSymlinks(kok)
		if gk == "" {
			gk = kok
		}
		if r2, err := filepath.Rel(gk, gercek); err != nil || r2 == ".." || strings.HasPrefix(r2, ".."+string(filepath.Separator)) {
			return "", errors.New("klasör dışı yol")
		}
	}
	if !uzantilar[strings.ToLower(filepath.Ext(tam))] {
		return "", errors.New("desteklenmeyen dosya türü")
	}
	return tam, nil
}

func (k *Kopru) Isleyici(klasorAc func(string)) http.Handler {
	mux := http.NewServeMux()
	jsonYaz := func(w http.ResponseWriter, kod int, v any) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(kod)
		_ = json.NewEncoder(w).Encode(v)
	}
	mux.HandleFunc("/durum", func(w http.ResponseWriter, r *http.Request) {
		xs, _ := Liste(k.Klasor())
		jsonYaz(w, 200, map[string]any{"uygulama": "celse-klasor", "surum": Surum, "klasor": k.Klasor(), "dosya": len(xs)})
	})
	mux.HandleFunc("/liste", func(w http.ResponseWriter, r *http.Request) {
		xs, err := Liste(k.Klasor())
		if err != nil {
			jsonYaz(w, 500, map[string]string{"hata": err.Error()})
			return
		}
		if xs == nil {
			xs = []Dosya{}
		}
		jsonYaz(w, 200, map[string]any{"klasor": k.Klasor(), "dosyalar": xs})
	})
	mux.HandleFunc("/dosya", func(w http.ResponseWriter, r *http.Request) {
		tam, err := GuvenliYol(k.Klasor(), r.URL.Query().Get("yol"))
		if err != nil {
			jsonYaz(w, 400, map[string]string{"hata": err.Error()})
			return
		}
		f, err := os.Open(tam)
		if err != nil {
			jsonYaz(w, 404, map[string]string{"hata": "dosya bulunamadı"})
			return
		}
		defer f.Close()
		st, _ := f.Stat()
		w.Header().Set("Content-Type", "application/octet-stream")
		http.ServeContent(w, r, "", st.ModTime(), f)
	})
	mux.HandleFunc("/klasor", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonYaz(w, 405, map[string]string{"hata": "POST"})
			return
		}
		var g struct {
			Yol string `json:"yol"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&g); err != nil {
			jsonYaz(w, 400, map[string]string{"hata": "geçersiz istek"})
			return
		}
		if err := k.KlasorDegistir(g.Yol); err != nil {
			jsonYaz(w, 400, map[string]string{"hata": err.Error()})
			return
		}
		jsonYaz(w, 200, map[string]string{"klasor": k.Klasor()})
	})
	mux.HandleFunc("/ac", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonYaz(w, 405, map[string]string{"hata": "POST"})
			return
		}
		if klasorAc != nil {
			klasorAc(k.Klasor())
		}
		jsonYaz(w, 200, map[string]bool{"ok": true})
	})
	return Kapi(mux)
}

// Kapi: yalnız Celse sayfası (Origin) ve yalnız 127.0.0.1 / localhost Host başlığı (DNS yeniden bağlama saldırısına karşı).
func Kapi(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, _ := net.SplitHostPort(r.Host)
		if host == "" {
			host = r.Host
		}
		if host != "127.0.0.1" && host != "localhost" {
			http.Error(w, "yasak", http.StatusForbidden)
			return
		}
		o := r.Header.Get("Origin")
		if !izinliKaynak[o] {
			http.Error(w, "yalnız Celse", http.StatusForbidden)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", o)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Private-Network", "true")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// Calistir: köprüyü başlatır. Aynı anda ikinci kopya çalışmaz (bağlantı noktası doluysa sessizce çıkılır).
func Calistir(k *Kopru, klasorAc func(string)) error {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", Port))
	if err != nil {
		return err
	}
	srv := &http.Server{Handler: k.Isleyici(klasorAc), ReadHeaderTimeout: 10 * time.Second}
	return srv.Serve(ln)
}

func main() {
	if err := baslat(os.Args[1:]); err != nil {
		hataGoster(err)
		os.Exit(1)
	}
}
