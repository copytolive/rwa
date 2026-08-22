FROM node:22.12-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY execution.mjs copy-engine.mjs worker.mjs ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production PORT=8787 RWA_STATE_PATH=/data/state.json
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8787/healthz >/dev/null || exit 1
CMD ["node","worker.mjs"]
