# [布里塔](https://chat.bulita.net/)

[English](./README.md) / 简体中文

布里塔是一个有趣的开源聊天室. 基于[node.js](https://nodejs.org/), [react](https://reactjs.org/) 和 [socket.io](https://socket.io/) 技术栈开发

官方网站: [https://chat.bulita.net/](https://chat.bulita.net)

Github: [https://github.com/gochendong/bulita](https://github.com/gochendong/bulita)

## 特色

1. 前后端100%完全开源, 基于源码快速构建
2. 设置机器人自动回复, 为每个机器人设置单独的api, 并使用Markdown渲染机器人回复内容
3. 通过配置文件一键初始化群组, 联系人, bot等等
4. 你可以在官方网站上找到开发者, 及时解答你的疑问

## 安装

1. 切换到源码文件夹
    ```
    git clone https://github.com/gochendong/bulita && cd bulita
    ```
2. 复制 .env.example 到 .env 并编辑它
3. 运行Redis服务, 如果已经在运行了, 跳过这步
    ```
    docker-compose -f docker-compose-redis.yaml up --build -d
    ```
4. 运行MongoDB服务, 如果已经在运行了, 跳过这步
    ```
    docker-compose -f docker-compose-mongo.yaml up --build -d
    ```
5. 运行聊天室服务
    ```
    docker-compose -f docker-compose.yaml up --build -d
    ```
6. 现在你可以开始通过 http://localhost:9200 访问聊天室


## 参考项目

[https://github.com/yinxin630/fiora](https://github.com/yinxin630/fiora)

## License

布里塔 is [MIT licensed](./LICENSE)
