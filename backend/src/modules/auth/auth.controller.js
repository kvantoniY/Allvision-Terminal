import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { randomBytes } from 'crypto';
const genPublicId = () => randomBytes(9).toString('base64url');

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(72)
});

const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(72)
});

function signAccess(user) {
  return jwt.sign(
    { username: user.username },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: `${env.ACCESS_TTL_MIN}m` }
  );
}

export async function register(req, res, next) {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const exists = await db.models.User.findOne({ where: { username } });
    if (exists) return res.status(409).json({ message: 'Username already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.models.User.create({
      username,
      passwordHash,
      publicId: genPublicId()
    });


    await db.models.PrivacySettings.create({ userId: user.id });

    const token = signAccess(user);
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { next(e); }
}

export async function login(req, res, next) {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await db.models.User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signAccess(user);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { next(e); }
}

export async function me(req, res, next) {
  try {
    const user = await db.models.User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'avatarUrl', 'bio'],
      include: [{ model: db.models.PrivacySettings, as: 'Privacy' }]
    });
    res.json({ user });
  } catch (e) { next(e); }
}
