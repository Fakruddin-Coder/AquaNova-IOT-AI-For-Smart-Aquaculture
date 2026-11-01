import mongoose from 'mongoose';

export let isDBConnected = false;

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/aquanova';
    mongoose.set('bufferCommands', false); // Don't hang requests if MongoDB is offline
    const conn = await mongoose.connect(connStr, { serverSelectionTimeoutMS: 2500 });
    isDBConnected = true;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    isDBConnected = false;
    console.warn(`[MongoDB Notice] Local MongoDB server not detected: ${(error as Error).message}. Using fast in-memory fallback store.`);
  }
};
