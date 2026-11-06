#!/usr/bin/env bash
# Build the City-hosted basemap for the Geo-COP map (ADR-015) and upload it to the City's Supabase project.
#
#   ormoc.pmtiles                    an OpenStreetMap extract around Ormoc City, from a Protomaps daily build
#   fonts/<font>/<range>.pbf         the label fonts the map style asks for
#   sprites/v4/{light,dark}[@2x].{json,png}   the map icons
#
# Run on a workstation with internet access (not in the browser). Needs: curl, unzip and the `pmtiles` CLI
# (https://github.com/protomaps/go-pmtiles/releases). Upload needs the project's service_role key; keep it on
# this workstation only and never put it in the app's settings.
#
#   SUPABASE_URL=https://jmctsspadywjcbbqwweh.supabase.co SERVICE_ROLE_KEY=... bash scripts/build_basemap.sh
#
# Options (environment):
#   BUILD    a Protomaps daily build date, YYYYMMDD (default: yesterday). See https://maps.protomaps.com/builds/
#   BBOX     west,south,east,north (default covers Ormoc City and its approaches with a margin)
#   MAXZOOM  highest zoom to keep (default 15: streets and buildings; about 30-60 MB)
#   OUT      working folder (default ./basemap-build)
#   SKIP_UPLOAD=1 to build only
#
# The data is OpenStreetMap (ODbL): the map shows "© OpenStreetMap contributors". Re-run every few months.
set -euo pipefail
BUILD=${BUILD:-$(date -u -d 'yesterday' +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d)}
BBOX=${BBOX:-124.40,10.85,124.90,11.30}
MAXZOOM=${MAXZOOM:-15}
OUT=${OUT:-./basemap-build}
ASSETS=https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

command -v pmtiles >/dev/null || { echo "Install the pmtiles CLI first: https://github.com/protomaps/go-pmtiles/releases"; exit 1; }
mkdir -p "$OUT"

echo "1/3 Extracting Ormoc from the Protomaps build $BUILD (bbox $BBOX, up to zoom $MAXZOOM)…"
pmtiles extract "https://build.protomaps.com/$BUILD.pmtiles" "$OUT/ormoc.pmtiles" --bbox="$BBOX" --maxzoom="$MAXZOOM"
pmtiles show "$OUT/ormoc.pmtiles" | head -20

echo "2/3 Fetching fonts and sprites…"
curl -fsSL "$ASSETS" -o "$OUT/assets.zip"
rm -rf "$OUT/assets" && mkdir -p "$OUT/assets" && unzip -q "$OUT/assets.zip" -d "$OUT/assets"
SRC="$OUT/assets/basemaps-assets-main"
mkdir -p "$OUT/upload/fonts" "$OUT/upload/sprites/v4"
for f in "${FONTS[@]}"; do cp -r "$SRC/fonts/$f" "$OUT/upload/fonts/"; done
for s in light dark; do cp "$SRC/sprites/v4/$s".* "$SRC/sprites/v4/$s@2x".* "$OUT/upload/sprites/v4/"; done
cp "$OUT/ormoc.pmtiles" "$OUT/upload/"

if [ "${SKIP_UPLOAD:-}" = "1" ]; then echo "Built in $OUT/upload (upload skipped)."; exit 0; fi
: "${SUPABASE_URL:?Set SUPABASE_URL}"; : "${SERVICE_ROLE_KEY:?Set SERVICE_ROLE_KEY}"

echo "3/3 Uploading to the public 'basemap' bucket…"
type_of() { case "$1" in *.pmtiles) echo application/vnd.pmtiles;; *.pbf) echo application/x-protobuf;; *.json) echo application/json;; *.png) echo image/png;; *) echo application/octet-stream;; esac; }
n=0
while IFS= read -r -d '' file; do
  rel=${file#"$OUT/upload/"}
  enc=$(printf '%s' "$rel" | sed 's/ /%20/g')
  curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/basemap/$enc" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "x-upsert: true" -H "Content-Type: $(type_of "$file")" \
    -H "Cache-Control: max-age=604800" --data-binary @"$file" >/dev/null
  n=$((n + 1)); [ $((n % 100)) -eq 0 ] && echo "  $n files…"
done < <(find "$OUT/upload" -type f -print0)
echo "Uploaded $n files. Open the app: EOC → Map. The 'Basemap not available' notice should be gone."
