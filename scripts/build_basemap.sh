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
BUILD_SET=${BUILD:-}
BUILD=${BUILD:-$(date -u -d 'yesterday' +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d)}
BBOX=${BBOX:-124.40,10.85,124.90,11.30}
MAXZOOM=${MAXZOOM:-15}
OUT=${OUT:-./basemap-build}
ASSETS=https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip
FONTS=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

mkdir -p "$OUT"
# 1.11: fetch the pmtiles CLI (pinned) when it is not installed; Linux and macOS, x86_64 or arm64.
PMTILES_VERSION=${PMTILES_VERSION:-1.28.0}
if ! command -v pmtiles >/dev/null; then
  os=$(uname -s); arch=$(uname -m); [ "$arch" = "aarch64" ] && arch=arm64
  case "$os" in Linux) pkg="go-pmtiles_${PMTILES_VERSION}_Linux_${arch}.tar.gz";; Darwin) pkg="go-pmtiles-${PMTILES_VERSION}_Darwin_${arch}.zip";; *) echo "Install the pmtiles CLI: https://github.com/protomaps/go-pmtiles/releases"; exit 1;; esac
  echo "0/3 Fetching the pmtiles CLI v$PMTILES_VERSION…"
  curl -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${pkg}" -o "$OUT/$pkg"
  case "$pkg" in *.zip) unzip -qo "$OUT/$pkg" pmtiles -d "$OUT";; *) tar xzf "$OUT/$pkg" -C "$OUT" pmtiles;; esac
  chmod +x "$OUT/pmtiles"; PATH="$OUT:$PATH"
fi

# The build server must be reachable (it is not from sandboxed environments). Daily builds can lag a day:
# fall back to the day before when the default build is not published yet.
if ! curl -fsI --max-time 20 "https://build.protomaps.com/$BUILD.pmtiles" >/dev/null 2>&1; then
  alt=$(date -u -d "$BUILD -1 day" +%Y%m%d 2>/dev/null || echo "")
  if [ -n "$alt" ] && [ -z "${BUILD_SET:-}" ] && curl -fsI --max-time 20 "https://build.protomaps.com/$alt.pmtiles" >/dev/null 2>&1; then BUILD=$alt
  else echo "Cannot reach https://build.protomaps.com/$BUILD.pmtiles. Run this where the internet is open, or use the"
       echo "GitHub workflow 'Build City basemap' (Actions tab), which runs it on GitHub's servers."; exit 2; fi
fi
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

size=$(wc -c < "$OUT/ormoc.pmtiles")
echo "Basemap size: $((size / 1048576)) MB"
if [ "$size" -gt 52428800 ]; then
  echo "Note: larger than 50 MB. Raise the project's global file size limit (Dashboard → Storage → Settings) above this size,"
  echo "      or build again with MAXZOOM=14 (about half the size). The 'basemap' bucket itself allows 500 MB."
fi
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
