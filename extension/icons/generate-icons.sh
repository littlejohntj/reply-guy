#!/bin/bash
# Generate placeholder icons (requires ImageMagick)
# Or replace with your own icons

for size in 16 48 128; do
  convert -size ${size}x${size} xc:#3b82f6 \
    -gravity center \
    -fill white \
    -pointsize $((size/2)) \
    -annotate 0 "R" \
    icon${size}.png 2>/dev/null || echo "Install ImageMagick to generate icons, or add your own icon${size}.png"
done
