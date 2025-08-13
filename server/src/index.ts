import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { env } from './env';
import routes from './routes';
import { registerSockets } from './sockets';

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.CORS_ORIGIN } });
registerSockets(io);

server.listen(env.PORT, () => console.log(`[server] listening on :${env.PORT}`));


