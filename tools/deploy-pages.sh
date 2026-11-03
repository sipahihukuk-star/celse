#!/usr/bin/env bash
# Web sürümünü GitHub Pages'e (gh-pages dalı) yükler: https://sipahihukuk-star.github.io/celse/
# Göreli yollara çevirir (site /celse/ alt klasöründe çalışır) ve Jekyll'i kapatır (_expo klasörü için).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && npx expo export -p web >/dev/null
T=$(mktemp -d); cp -r dist/. "$T"/
sed -i 's#"/_expo/#"./_expo/#g; s#"/favicon.ico"#"./favicon.ico"#g; s#<html lang="en">#<html lang="tr">#' "$T/index.html"
for f in "$T"/_expo/static/js/web/*.js; do sed -i 's#"/assets/#"./assets/#g' "$f"; done
touch "$T/.nojekyll"
cd "$T" && git init -q && git checkout -q -b gh-pages && git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Web sürümü $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
echo "yayınlandı: https://sipahihukuk-star.github.io/celse/"
