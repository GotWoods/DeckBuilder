import { Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  provider: 'google' | 'facebook';
  providerId: string;
  avatar?: string;
  createdAt: Date;
}