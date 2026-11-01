FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runs as any non-root UID (OpenShift). Listen port = PORT env (default 8080, must be >= 1024).
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
