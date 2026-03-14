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

- 前后端完全开源，可直接基于源码二次开发。
- 支持机器人自动回复，并可为每个机器人单独配置 API。
- 机器人回复支持 Markdown 渲染。
- 可通过配置文件一键初始化默认群组、联系人和机器人。

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
