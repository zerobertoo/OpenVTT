FROM node:24-slim

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY systems ./systems
RUN pnpm install --frozen-lockfile && pnpm --filter @openvtt/client build

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    OPENVTT_DB=/data/openvtt.db
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["pnpm", "--filter", "@openvtt/server", "start"]
