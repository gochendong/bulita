<div align="center">
<h1> Bulita </h1>

English / [简体中文](./README_ZH.md)

Bulita is an interesting open source chatroom. It is developed based on [node.js](https://nodejs.org/), [react](https://reactjs.org/) and [socket.io](https://socket.io/) technologies

Online Example: [https://chat.bulita.net/](https://chat.bulita.net)

Github: [https://github.com/gochendong/bulita](https://github.com/gochendong/bulita)
</div>

## Features

1. 100% fully open source frontend and backend, allowing for rapid construction based on the source code.
2. Set up automatic replies for robots, set up separate APIs for each robot, and use Markdown to render the content of robot replies.
3. One-click initialization of groups, contacts, bots, etc. through configuration files.
4. You can find developers on the official website who can answer your questions in a timely manner.

## Install

1. Switch to the code folder
    ```
    git clone https://github.com/gochendong/bulita && cd bulita
    ```
2. copy the .env.example to .env and edit it
3. Start the Redis service. If it is already running, skip this step
    ```
    docker-compose -f docker-compose-redis.yaml up --build -d
    ```
4. Start the MongoDB service. If it is already running, skip this step
    ```
    docker-compose -f docker-compose-mongo.yaml up --build -d
    ```
5. Start the chatroom service
    ```
    docker-compose -f docker-compose.yaml up --build -d
    ```
6. Now you can access the chatroom through http://localhost:9200


## Referenced project

[https://github.com/yinxin630/fiora](https://github.com/yinxin630/fiora)

## License

bulita is [MIT licensed](./LICENSE)

## Sponsor this project

![](https://docs.bulita.net/media/202412/usdt_1733018911.png)
