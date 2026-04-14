# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# SDK clients are pre-generated and committed (openapi-generator requires Java).
# To regenerate locally: npm run sdk:generate
RUN npx ng build ruby-frontend --configuration=production

# ── Stage 2: Runtime (Nginx) ─────────────────────────────────────────────────
FROM nginx:alpine

RUN addgroup -S rubymusic && adduser -S rubymusic -G rubymusic

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist/ruby-frontend/browser /usr/share/nginx/html

RUN chown -R rubymusic:rubymusic /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
