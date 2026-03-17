<div align="center">
  <h1>Bulita</h1>
  <p><a href="./README.md">简体中文</a> / English</p>
  <p>An open source chatroom built with Node.js, React, Socket.IO, MongoDB, and Redis.</p>
  <p>
    <a href="https://chat.bulita.net/">Online Demo</a> ·
    <a href="https://github.com/gochendong/bulita">GitHub</a>
  </p>
</div>

## Highlights

- A complete chat stack out of the box: frontend, backend, realtime transport, and storage are all included and can be started directly with Docker.
- More than basic IM: supports group chat, private chat, self chat, AI chat, image and file sending, quoted replies, and expression search in one product.
- AI is built in, not bolted on: bot auto-replies, per-bot API settings, Markdown rendering, and group AI switches are already part of the system.
- Low setup and ops overhead: default groups, contacts, and bots can be bootstrapped from config, while admins can tune key runtime settings from the console.

## Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/gochendong/bulita.git
   cd bulita
   ```

2. Create your local env file:

   ```bash
   cp .env.example .env
   ```

3. Update the required values in `.env`.

   Required service credentials:

   - `MONGODB_USERNAME`
   - `MONGODB_PASSWORD`
   - `REDIS_PASSWORD`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `ADMIN_EMAILS`

4. Start all services:

   ```bash
   docker compose up --build -d
   ```

5. Open the app:

   - Web: [http://localhost:9200](http://localhost:9200)

## Default Service Ports

- Bulita web/server: `9200`
- MongoDB published port: `27018`
- Redis published port: `6380`

The application container connects to MongoDB and Redis through Docker service names, so the internal ports remain `27017` and `6379`.

## Notes

- MongoDB and Redis are password-protected by default.
- `ADMIN_EMAILS` is required. The first email is used to pre-create the default group owner.
- Default bot bootstrap still depends on `BOTS` and related env values.
- Google login requires a valid `GOOGLE_CLIENT_ID` and the correct authorized JavaScript origins in Google Cloud Console.

## Reference

- Based on ideas from [fiora](https://github.com/yinxin630/fiora)

## License

[MIT](./LICENSE)
