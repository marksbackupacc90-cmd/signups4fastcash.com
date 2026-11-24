# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S s4fc && adduser -S s4fc -G s4fc
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=s4fc:s4fc /app/dist ./dist
COPY --from=build --chown=s4fc:s4fc /app/public ./public
COPY --from=build --chown=s4fc:s4fc /app/server.js ./server.js
COPY --from=build --chown=s4fc:s4fc /app/scripts ./scripts
USER s4fc
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
