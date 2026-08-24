FROM node:22.16.0-bookworm-slim
WORKDIR /app
COPY commerce-service/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY commerce-service/ ./
COPY rwa-commerce-registry.json rwa-assets.json ../
ENV NODE_ENV=production RWA_COMMERCE_HOST=0.0.0.0 RWA_COMMERCE_PORT=8788 RWA_COMMERCE_DB=/data/commerce.sqlite
VOLUME ["/data"]
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8788/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
