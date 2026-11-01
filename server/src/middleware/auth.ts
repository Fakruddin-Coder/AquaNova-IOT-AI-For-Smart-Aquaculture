import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AuthRequest = Request & {
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
};

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing or invalid' });
  }

  const secret = process.env.JWT_SECRET || 'aquanova_jwt_secret_key_2026';
  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string; name?: string; role?: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token is invalid or expired' });
  }
};
