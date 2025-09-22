import express from 'express';
import passport from '../config/passport';
import { handleOAuthCallback, getCurrentUser, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  handleOAuthCallback
);


// Get current user info
router.get('/me', requireAuth, getCurrentUser);

// Logout
router.post('/logout', logout);

export default router;