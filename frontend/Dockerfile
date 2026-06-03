FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server binds to HOSTNAME (defaults to localhost). Render and
# other container hosts route to the container's external interface, so it must
# bind 0.0.0.0 or the proxy gets connection-refused → 502. PORT is injected by the
# host at runtime; Next standalone respects it (falls back to 3000 locally).
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
