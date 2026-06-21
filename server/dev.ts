import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';

import authLogin from '../api/auth/login';
import authLogout from '../api/auth/logout';
import authMe from '../api/auth/me';
import authRegister from '../api/auth/register';
import schedules from '../api/schedules/index';
import extras from '../api/extras/index';
import extrasId from '../api/extras/[id]';
import swaps from '../api/swaps/index';
import swapsId from '../api/swaps/[id]';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.all('/api/auth/login', (req, res) => authLogin(req as any, res as any));
app.all('/api/auth/logout', (req, res) => authLogout(req as any, res as any));
app.all('/api/auth/me', (req, res) => authMe(req as any, res as any));
app.all('/api/auth/register', (req, res) => authRegister(req as any, res as any));
app.all('/api/schedules', (req, res) => schedules(req as any, res as any));
app.all('/api/extras', (req, res) => extras(req as any, res as any));
app.all('/api/extras/:id', (req, res) => {
  (req as any).query = { ...(req as any).query, id: req.params.id };
  extrasId(req as any, res as any);
});
app.all('/api/swaps', (req, res) => swaps(req as any, res as any));
app.all('/api/swaps/:id', (req, res) => {
  (req as any).query = { ...(req as any).query, id: req.params.id };
  swapsId(req as any, res as any);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
