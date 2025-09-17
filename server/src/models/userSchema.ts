import mongoose, { Schema } from 'mongoose';
import { IUser } from './IUser';

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['google', 'facebook'],
    required: true
  },
  providerId: {
    type: String,
    required: true
  },
  avatar: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for provider and providerId for efficient lookups
userSchema.index({ provider: 1, providerId: 1 }, { unique: true });

const UserModel = mongoose.model<IUser>('User', userSchema);

export default UserModel;