# 第一阶段：构建依赖和代码
FROM node:14-alpine AS builder

WORKDIR /usr/app/bulita

# 优先复制依赖定义文件，利用 Docker 缓存
COPY package.json yarn.lock lerna.json ./
COPY packages/web/package.json ./packages/web/
COPY packages/server/package.json ./packages/server/
COPY packages/utils/package.json ./packages/utils/
COPY packages/config/package.json ./packages/config/
COPY packages/assets/package.json ./packages/assets/
COPY packages/database/package.json ./packages/database/
COPY packages/bin/package.json ./packages/bin/

# 使用 --frozen-lockfile 和 --prefer-offline 加速依赖安装
RUN yarn install --frozen-lockfile --prefer-offline --network-timeout 300000

# 复制源代码
COPY packages ./packages
COPY .env ./packages/web
COPY tsconfig.json ./

# 并行构建（使用 --concurrency 增加并行度）
RUN yarn build:web --concurrency 4

# 第二阶段：运行时镜像
FROM node:14-alpine AS runner

WORKDIR /usr/app/bulita

# 只复制运行时必需的文件
COPY package.json yarn.lock lerna.json ./
COPY packages ./packages
COPY packages/server/public ./packages/server/public
COPY .env ./packages/web

# 只安装生产依赖
RUN yarn install --frozen-lockfile --prefer-offline --production --network-timeout 300000

CMD ["yarn", "start"]
