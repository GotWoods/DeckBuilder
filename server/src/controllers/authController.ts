import { Request, Response } from 'express';
import { IUser } from '../models/IUser';
import { generateToken } from '../utils/jwtUtils';
import logger from '../config/logger';

export const handleOAuthCallback = (req: Request, res: Response): void => {
  if (!req.user) {
    logger.error('OAuth callback failed - no user found');
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    return;
  }

  const token = generateToken(req.user as IUser);

  // Redirect to frontend with token
  res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
};

export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const user = req.user as IUser;
  res.json({
    success: true,
    data: {
      id: user._id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      avatar: user.avatar
    }
  });
};

export const logout = (req: Request, res: Response): void => {
  res.json({ success: true, message: 'Logged out successfully' });
};