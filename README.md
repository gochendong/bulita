# [Bulita](https://chat.bulita.net/)


Bulita is an interesting open source chatroom. It is developed based on [node.js](https://nodejs.org/), [react](https://reactjs.org/) and [socket.io](https://socket.io/) technologies

Online Example: [https://chat.bulita.net/](https://chat.bulita.net)

Github: [https://github.com/gochendong/bulita](https://github.com/gochendong/bulita)

## Features

1. No registration required, one-click login.
2. Set multiple robots for automatic replies, Render the message of the robot using Markdown.
3. All parameters can be customized through configuration file.
4. Active official website and proactive project maintenance.

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
