# syntax=docker/dockerfile:1.4
# 使用 BuildKit 启用缓存挂载，构建时: DOCKER_BUILDKIT=1 docker build .
FROM node:20-alpine

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /usr/app/bulita

# 1. 只复制依赖定义，利用层缓存：依赖未变时跳过 yarn install
COPY package.json yarn.lock lerna.json tsconfig.json ./
COPY packages/assets/package.json packages/assets/
COPY packages/bin/package.json packages/bin/
COPY packages/config/package.json packages/config/
COPY packages/database/package.json packages/database/
COPY packages/server/package.json packages/server/
COPY packages/utils/package.json packages/utils/
COPY packages/web/package.json packages/web/

# 使用缓存挂载加速 install（需 BuildKit）
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn/v6 \
    yarn install --frozen-lockfile

# 2. 再复制源码，代码变更不会导致重新 install
COPY packages ./packages

# 优先用 .env，不存在则用 .env.example（生产环境用运行时 env 或挂载覆盖）
COPY .env* ./
RUN if [ ! -f .env ]; then cp .env.example .env 2>/dev/null || true; fi && cp .env packages/web/

# 3. 构建前端
RUN yarn build:web

CMD ["yarn", "start"]
