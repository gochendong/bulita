<div align="center">
  <h1>Bulita</h1>
  <p>English / <a href="./README_ZH.md">简体中文</a></p>
  <p>An open source chatroom built with Node.js, React, Socket.IO, MongoDB, and Redis.</p>
  <p>
    <a href="https://chat.bulita.net/">Online Demo</a> ·
    <a href="https://github.com/gochendong/bulita">GitHub</a>
  </p>
</div>

## Highlights

- Fully open source frontend and backend.
- Bot auto-replies with per-bot API configuration.
- Markdown rendering for bot messages.
- One-step initialization of default groups, contacts, and bots from config.

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

4. Start all services:

   ```bash
   docker compose up --build -d
   ```

5. Open the app:

   - Web: [http://localhost:9200](http://localhost:9200)

## Default Service Ports

- Bulita web/server: `9200`
- MongoDB host port: `27018`
- Redis host port: `6380`

The application container connects to MongoDB and Redis through Docker service names, so the internal ports remain `27017` and `6379`.

## Notes

- MongoDB and Redis are password-protected by default.
- Default admin/bot bootstrap still depends on `ADMINS`, `BOTS`, and related env values.
- Google login requires a valid `GOOGLE_CLIENT_ID` and the correct authorized JavaScript origins in Google Cloud Console.

## Reference

- Based on ideas from [fiora](https://github.com/yinxin630/fiora)

## License

[MIT](./LICENSE)

## Sponsor

![](https://docs.bulita.net/media/202412/usdt_1733018911.png)
