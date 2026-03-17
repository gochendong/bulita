import Koa from 'koa';
import koaSend from 'koa-send';
import koaStatic from 'koa-static';
import bodyParser from 'koa-bodyparser';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';

import logger from '@bulita/utils/logger';
import config from '@bulita/config/server';
import { getSocketIp } from '@bulita/utils/socket';
import SocketModel, {
    SocketDocument,
} from '@bulita/database/mongoose/models/socket';

import seal from './middlewares/seal';
import frequency from './middlewares/frequency';
import isLogin from './middlewares/isLogin';
import isAdmin from './middlewares/isAdmin';

import * as userRoutes from './routes/user';
import * as groupRoutes from './routes/group';
import * as messageRoutes from './routes/message';
import * as systemRoutes from './routes/system';
import * as notificationRoutes from './routes/notification';
import * as historyRoutes from './routes/history';
import registerRoutes from './middlewares/registerRoutes';
import { setSocketServer } from './utils/socketServer';

const app = new Koa();

app.use(
    bodyParser({
        formLimit: '1024mb',
        jsonLimit: '1024mb',
        textLimit: '1024mb',
        limit: '1024mb',
    }),
);

app.proxy = true;

const httpServer = http.createServer(app.callback());
const io = new Server(httpServer, {
    cors: {
        origin: config.allowOrigin || '*',
        credentials: true,
    },
    pingTimeout: 6000000,
    pingInterval: 6000000,
    maxHttpBufferSize: 1024 * 1024 * 1024, // 设置为1024MB
});
setSocketServer(io);

// serve index.html（不缓存，刷新即获取最新版本）
app.use(async (ctx, next) => {
    if (
        /\/invite\/group\/[\w\d]+/.test(ctx.request.url) ||
        !/(\.)|(\/invite\/group\/[\w\d]+)/.test(ctx.request.url)
    ) {
        ctx.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        ctx.set('Pragma', 'no-cache');
        ctx.set('Expires', '0');
        await koaSend(ctx, 'index.html', {
            root: path.join(__dirname, '../public'),
            maxage: 0,
            gzip: true,
        });
    } else {
        await next();
    }
});

// serve public static files（不缓存，刷新即获取最新版本）
app.use(
    koaStatic(path.join(__dirname, '../public'), {
        maxAge: 0,
        gzip: true,
    }),
);

const routes: Routes = {
    ...userRoutes,
    ...groupRoutes,
    ...messageRoutes,
    ...systemRoutes,
    ...notificationRoutes,
    ...historyRoutes,
};
Object.keys(routes).forEach((key) => {
    if (key.startsWith('_')) {
        routes[key] = null;
    }
});

io.on('connection', async (socket) => {
    const ip = getSocketIp(socket);
    logger.trace(`connection ${socket.id} ${ip}`);
    await SocketModel.create({
        id: socket.id,
        ip,
    } as SocketDocument);

    socket.on('disconnect', async () => {
        logger.trace(`disconnect ${socket.id}`);
        await SocketModel.deleteOne({
            id: socket.id,
        });
    });

    socket.use(seal(socket));
    socket.use(isLogin(socket));
    socket.use(isAdmin(socket));
    socket.use(frequency(socket));
    socket.use(registerRoutes(socket, routes));
});

export default httpServer;
