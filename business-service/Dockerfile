FROM node:22.14.0-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY schema.sql store.mjs commerce-reader.mjs validation.mjs server.mjs monitor.mjs ./
RUN mkdir -p /var/lib/rwa-business /var/lib/rwa-commerce && chown -R node:node /app /var/lib/rwa-business /var/lib/rwa-commerce
USER node
ENV NODE_ENV=production
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8790/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server.mjs"]
