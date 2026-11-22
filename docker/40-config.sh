#!/bin/sh
# Runs at container start (nginx entrypoint): writes runtime config for the front.
# Served at /config.js (see nginx/default.conf.template).
set -eu
# Env value -> JSON string: drop control chars (incl. CR/LF), escape \ and ".
js() {
  v=$(printf '%s' "$1" | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '"%s"' "$v"
}
author=$(js "${VITE_AUTHOR:-}")
printf 'window.__ENV = { "author": %s }\n' "$author" > /tmp/config.js
