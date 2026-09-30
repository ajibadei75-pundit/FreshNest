# FreshNest has no dependencies, so there is no install step: just Node and the code.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TRUST_PROXY=1

WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY scripts/healthcheck.js ./scripts/healthcheck.js

# Run as the unprivileged "node" user; /data is where bookings and photos live.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node scripts/healthcheck.js
CMD ["node", "server/index.js"]
