#!/bin/sh
# Rebuild tailwind.css from all HTML files.
# Requires the Tailwind CSS standalone CLI:
#   curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 -o tailwindcss
#   chmod +x tailwindcss
#
# Usage:
#   ./build-css.sh

set -e

TWCSS="./tailwindcss"

if [ ! -f "$TWCSS" ]; then
  echo "tailwindcss binary not found. Downloading..."
  curl -sL "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64" -o "$TWCSS"
  chmod +x "$TWCSS"
fi

cat > /tmp/tw-input.css << 'EOF'
@import "tailwindcss";
EOF

"$TWCSS" \
  --input /tmp/tw-input.css \
  --content "*.html" \
  --output tailwind.css \
  --minify

echo "tailwind.css rebuilt ($(wc -c < tailwind.css) bytes)"
