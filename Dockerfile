FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runs as any non-root UID (OpenShift). Listen port = PORT env (default 8080, must be >= 1024).
# Runtime env read at start into /config.js: VITE_AUTHOR (footer, empty = "yonka").
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=0755 docker/40-config.sh /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
