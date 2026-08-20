# Node 22.5+ is required: the backend uses the built-in node:sqlite module,
# which avoids a native build step in the container entirely.
FROM node:22-slim

# The scraper shells out to `npx -p @brightdata/cli bdata`, which needs a CA
# bundle to reach the Bright Data API over TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Pre-install the CLI into the image rather than letting npx fetch it on the
# first scrape — otherwise the first run pays a multi-second download and can
# time out behind a cold start.
RUN npm install --no-save @brightdata/cli
ENV BDATA_CLI=/app/node_modules/.bin/bdata

COPY src ./src

# SQLite lives on a mounted volume so scrape history survives redeploys —
# without it the diff engine has no previous snapshot and alerts never fire.
ENV DB_PATH=/data/scrapeverse.db
VOLUME ["/data"]

ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/server.js"]
