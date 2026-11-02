import mongoose from 'mongoose';

mongoose.connection.on('error', () => {
  console.error('MongoDB connection error. Check the database connection settings.');
});

mongoose.connection.on('disconnected', () => {
  console.error('MongoDB connection was lost.');
});

export async function connectDatabase({ uri = process.env.MONGODB_URI, serverSelectionTimeoutMS = 5000 } = {}) {
  if (!uri?.trim()) {
    throw new Error('MONGODB_URI is not set. Add your MongoDB connection string to backend/.env.');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS });
    console.log('Connected to MongoDB.');
    return mongoose.connection;
  } catch {
    // Do not include the original driver error: it can contain the connection URI.
    throw new Error('Could not connect to MongoDB. Check the URI, database credentials, and Atlas network access list.');
  }
}
