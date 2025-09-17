import jwt from 'jsonwebtoken';
import { IUser } from '../models/IUser';

export const generateToken = (user: IUser): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      provider: user.provider
    },
    jwtSecret,
    {
      expiresIn: '30d'
    }
  );
};