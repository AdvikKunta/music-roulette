import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import routes from './routes';
import { registerSockets } from './sockets';

dotenv.config(); // load .env values into process.env

const PORT = Number(process.env.PORT || 4000); // default port for local dev
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'; // allow local frontend

const app = express();
app.use(cors({ origin: CORS_ORIGIN })); // use env-defined frontend origin
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CORS_ORIGIN } }); // match CORS for sockets
registerSockets(io);

server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));


