package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func kurDeneme(t *testing.T) (*Kopru, string) {
	d := t.TempDir()
	kok := filepath.Join(d, "Celse Evrak")
	k := &Kopru{}
	if err := k.Yukle(filepath.Join(d, "ayar.json"), kok); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(filepath.Join(kok, "2024-1111 İzmir 2. Asliye"), 0o755)
	os.WriteFile(filepath.Join(kok, "2024-1111 İzmir 2. Asliye", "bilirkişi raporu.udf"), []byte("udf"), 0o644)
	os.WriteFile(filepath.Join(kok, "not.exe"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(kok, "~$gecici.docx"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(d, "gizli.pdf"), []byte("dışarıda"), 0o644)
	return k, d
}

func istek(h http.Handler, yontem, yol, origin, host string, govde string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(yontem, yol, strings.NewReader(govde))
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	r.Host = host
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestListeVeDosya(t *testing.T) {
	k, _ := kurDeneme(t)
	h := k.Isleyici(nil)
	w := istek(h, "GET", "/liste", "https://celse.themiscode.com", "127.0.0.1:47613", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "bilirkişi raporu.udf") || strings.Contains(w.Body.String(), "not.exe") || strings.Contains(w.Body.String(), "~$") {
		t.Fatalf("liste: %d %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "https://celse.themiscode.com" {
		t.Fatal("CORS başlığı yok")
	}
	w = istek(h, "GET", "/dosya?yol=2024-1111%20%C4%B0zmir%202.%20Asliye/bilirki%C5%9Fi%20raporu.udf", "https://celse.themiscode.com", "localhost:47613", "")
	if w.Code != 200 || w.Body.String() != "udf" {
		t.Fatalf("dosya: %d %s", w.Code, w.Body.String())
	}
}

func TestKapi(t *testing.T) {
	k, _ := kurDeneme(t)
	h := k.Isleyici(nil)
	if w := istek(h, "GET", "/liste", "https://kotu-site.example", "127.0.0.1:47613", ""); w.Code != 403 {
		t.Fatal("başka site okuyamamalı", w.Code)
	}
	if w := istek(h, "GET", "/liste", "", "127.0.0.1:47613", ""); w.Code != 403 {
		t.Fatal("Origin'siz istek reddedilmeli", w.Code)
	}
	if w := istek(h, "GET", "/liste", "https://celse.themiscode.com", "kotu.example:47613", ""); w.Code != 403 {
		t.Fatal("DNS yeniden bağlama reddedilmeli", w.Code)
	}
	w := istek(h, "OPTIONS", "/liste", "https://celse.themiscode.com", "127.0.0.1:47613", "")
	if w.Code != 204 || w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Fatal("ön istek", w.Code)
	}
}

func TestKlasorDisi(t *testing.T) {
	k, _ := kurDeneme(t)
	h := k.Isleyici(nil)
	for _, y := range []string{"../gizli.pdf", "..%2Fgizli.pdf", "/etc/passwd", "a/../../gizli.pdf", "C:%5CWindows%5Cwin.ini", "not.exe", ""} {
		w := istek(h, "GET", "/dosya?yol="+y, "https://celse.themiscode.com", "127.0.0.1:47613", "")
		if w.Code == 200 {
			t.Fatalf("klasör dışı okundu: %s", y)
		}
	}
	// Sembolik bağ ile dışarı çıkma
	_, d := kurDeneme(t)
	_ = d
	kok := k.Klasor()
	if err := os.Symlink(filepath.Join(filepath.Dir(kok), "gizli.pdf"), filepath.Join(kok, "bag.pdf")); err == nil {
		w := istek(h, "GET", "/dosya?yol=bag.pdf", "https://celse.themiscode.com", "127.0.0.1:47613", "")
		if w.Code == 200 {
			t.Fatal("sembolik bağla dışarı çıkıldı")
		}
	}
}

func TestKlasorDegistir(t *testing.T) {
	k, d := kurDeneme(t)
	h := k.Isleyici(nil)
	yeni := filepath.Join(d, "Yeni")
	os.MkdirAll(yeni, 0o755)
	w := istek(h, "POST", "/klasor", "https://celse.themiscode.com", "127.0.0.1:47613", `{"yol":"`+filepath.ToSlash(yeni)+`"}`)
	if w.Code != 200 || k.Klasor() != yeni {
		t.Fatalf("klasör değişmedi: %d %s", w.Code, w.Body.String())
	}
	b, _ := os.ReadFile(filepath.Join(d, "ayar.json"))
	if !strings.Contains(string(b), "Yeni") {
		t.Fatal("ayar yazılmadı")
	}
	if w := istek(h, "POST", "/klasor", "https://celse.themiscode.com", "127.0.0.1:47613", `{"yol":"goreli/yol"}`); w.Code != 400 {
		t.Fatal("göreli yol kabul edilmemeli")
	}
}
