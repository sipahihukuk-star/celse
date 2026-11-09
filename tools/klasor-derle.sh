#!/usr/bin/env bash
# Celse Klasör (masaüstü köprüsü) Windows kurulumunu derler: public/indir/CelseKlasorKurulum.exe (web ile birlikte yayınlanır).
# Go gerekir. Önce birim denemeleri çalışır.
set -euo pipefail
cd "$(dirname "$0")/../masaustu/klasor"
go vet ./... && go test ./...
mkdir -p ../../public/indir
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H=windowsgui -s -w" -o ../../public/indir/CelseKlasorKurulum.exe .
ls -la ../../public/indir/CelseKlasorKurulum.exe
