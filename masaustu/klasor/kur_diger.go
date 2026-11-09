//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Windows dışı (deneme ve ileride Mac): kurulum yok, köprü doğrudan çalışır.
func hataGoster(err error) { fmt.Fprintln(os.Stderr, "Celse Klasör:", err) }
func baslat(arg []string) error {
	ev, _ := os.UserHomeDir()
	klasor := filepath.Join(ev, "Documents", "Celse Evrak")
	if len(arg) > 1 && arg[0] == "--klasor" {
		klasor = arg[1]
	}
	k := &Kopru{}
	if err := k.Yukle(filepath.Join(ev, ".celse-klasor.json"), klasor); err != nil {
		return err
	}
	fmt.Println("Celse Klasör", Surum, "·", k.Klasor(), "· 127.0.0.1:", Port)
	return Calistir(k, func(y string) { _ = exec.Command("xdg-open", y).Start() })
}
