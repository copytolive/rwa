FROM node:22.12-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY execution.mjs worker.mjs ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV NODE_ENV=production PORT=8787 RWA_STATE_PATH=/data/state.json
EXPOSE 8787
CMD ["node","worker.mjs"]
