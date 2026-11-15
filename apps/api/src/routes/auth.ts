import type { FastifyInstance, FastifyReply } from 'fastify';
import { LoginBody, RegisterBody, type Me } from '@qullqa/shared';
import { sql } from '../db.ts';
import { HttpError, SESSION_COOKIE, parse, requireUser } from '../http.ts';
import { clearFailures, hashPin, isLocked, recordFailure, verifyPin } from '../security.ts';

const NINETY_DAYS = 90 * 24 * 3600;

async function startSession(reply: FastifyReply, user: { id: string; name: string }) {
  const token = await reply.jwtSign({ sub: user.id, name: user.name }, { expiresIn: NINETY_DAYS });
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true, // los navegadores aceptan Secure en http://localhost
    sameSite: 'lax',
    maxAge: NINETY_DAYS,
  });
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (req, reply) => {
    const body = parse(RegisterBody, req.body);
    const pinHash = await hashPin(body.pin);
    const [user] = await sql<{ id: string; name: string }[]>`
      insert into users (name, phone, pin_hash) values (${body.name}, ${body.phone}, ${pinHash})
      on conflict (phone) do nothing
      returning id, name`;
    if (!user) throw new HttpError(409, 'Ese número ya está registrado. Ingresa con tu PIN.');
    await startSession(reply, user);
    return { id: user.id, name: user.name };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = parse(LoginBody, req.body);
    if (isLocked(body.phone)) throw new HttpError(429, 'Demasiados intentos. Espera 10 minutos.');
    const [user] = await sql<{ id: string; name: string; pin_hash: string }[]>`
      select id, name, pin_hash from users where phone = ${body.phone}`;
    if (!user || !(await verifyPin(body.pin, user.pin_hash))) {
      recordFailure(body.phone);
      throw new HttpError(401, 'Número o PIN incorrecto');
    }
    clearFailures(body.phone);
    await startSession(reply, user);
    return { id: user.id, name: user.name };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/me', async (req): Promise<Me> => {
    const s = await requireUser(req);
    const [user] = await sql<{ id: string; name: string }[]>`select id, name from users where id = ${s.sub}`;
    if (!user) throw new HttpError(401, 'Inicia sesión');
    const communities = await sql<Me['communities']>`
      select c.id, c.name, c.slug from memberships m join communities c on c.id = m.community_id
      where m.user_id = ${s.sub} order by m.joined_at`;
    return { id: user.id, name: user.name, communities: [...communities] };
  });
}
