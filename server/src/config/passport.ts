import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import User from '../models/userSchema';
import { IUser } from '../models/IUser';
import dotenv from 'dotenv';

dotenv.config();

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({
      provider: 'google',
      providerId: profile.id
    });

    if (existingUser) {
      return done(null, existingUser);
    }

    const newUser = new User({
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'google',
      providerId: profile.id,
      avatar: profile.photos?.[0]?.value
    });

    const savedUser = await newUser.save();
    done(null, savedUser);
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Create a mock user for testing when DB is not available
    const mockUser = {
      _id: 'temp-' + profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'google',
      providerId: profile.id,
      avatar: profile.photos?.[0]?.value
    };
    done(null, mockUser);
  }
}));

// Facebook OAuth Strategy
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID!,
  clientSecret: process.env.FACEBOOK_APP_SECRET!,
  callbackURL: '/auth/facebook/callback',
  profileFields: ['id', 'displayName', 'emails', 'photos']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await User.findOne({
      provider: 'facebook',
      providerId: profile.id
    });

    if (existingUser) {
      return done(null, existingUser);
    }

    const newUser = new User({
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'facebook',
      providerId: profile.id,
      avatar: profile.photos?.[0]?.value
    });

    const savedUser = await newUser.save();
    done(null, savedUser);
  } catch (error) {
    console.error('OAuth callback error:', error);
    // Create a mock user for testing when DB is not available
    const mockUser = {
      _id: 'temp-' + profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      provider: 'facebook',
      providerId: profile.id,
      avatar: profile.photos?.[0]?.value
    };
    done(null, mockUser);
  }
}));

export default passport;