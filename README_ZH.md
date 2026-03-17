<div align="center">
  <h1>布里塔</h1>
  <p>简体中文 / <a href="./README_EN.md">English</a></p>
  <p>一个基于 Node.js、React、Socket.IO、MongoDB 和 Redis 的开源聊天室。</p>
  <p>
    <a href="https://chat.bulita.net/">在线演示</a> ·
    <a href="https://github.com/gochendong/bulita">GitHub</a>
  </p>
</div>

## 特色

- 开箱即用的完整聊天室方案：前端、服务端、实时通信、存储层全部在仓库内，拉起 Docker 后即可直接运行。
- 不只是基础 IM：同时覆盖群聊、私聊、自己对话、AI 对话、图片文件发送、引用回复和表情搜索等常用场景。
- AI 能力可深度接入：支持机器人自动回复、独立 API 配置、Markdown 渲染，以及群聊 AI 开关等运营能力。
- 初始化和运维成本低：可通过配置预置默认群组、联系人和机器人，管理员也能在控制台直接调整关键运行参数。

## 快速开始

1. 克隆仓库：

   ```bash
   git clone https://github.com/gochendong/bulita.git
   cd bulita
   ```

2. 复制环境变量模板：

   ```bash
   cp .env.example .env
   ```

3. 修改 `.env` 中的关键配置。

   必填项：

   - `MONGODB_USERNAME`
   - `MONGODB_PASSWORD`
   - `REDIS_PASSWORD`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `ADMIN_EMAILS`

4. 启动全部服务：

   ```bash
   docker compose up --build -d
   ```

5. 打开应用：

   - Web: [http://localhost:9200](http://localhost:9200)

## 默认端口

- Bulita Web/服务端：`9200`
- MongoDB 对外映射端口：`27018`
- Redis 对外映射端口：`6380`

应用容器内部会通过 Docker 服务名连接 MongoDB 和 Redis，因此容器内端口仍然是 `27017` 和 `6379`。

## 说明

- MongoDB 和 Redis 默认启用密码认证。
- `ADMIN_EMAILS` 为必填项，首个邮箱会作为默认群创建者的预创建管理员账号。
- 默认机器人初始化仍然依赖 `BOTS` 等环境变量。
- Google 登录需要有效的 `GOOGLE_CLIENT_ID`，并在 Google Cloud Console 中配置正确的 JavaScript 来源。

## 参考项目

- 灵感参考 [fiora](https://github.com/yinxin630/fiora)

## 开源协议

[MIT](./LICENSE)
