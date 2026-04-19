FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV TRUST_PROXY=1
ENV QTECH_DATA_DIR=/data/qtech
ENV QTECH_ENABLE_DEMO_SEEDING=false

EXPOSE 3000

CMD ["pnpm", "start"]
