import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '../models/IUser';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ success: false, error: 'Server configuration error' });
    return;
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      res.status(401).json({ success: false, error: 'Invalid token' });
      return;
    }

    req.user = decoded as IUser;
    next();
  });
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    next();
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    next();
    return;
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (!err) {
      req.user = decoded as IUser;
    }
    next();
  });
};

