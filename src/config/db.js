const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.mongoURI;
  if (!uri) {
    throw new Error('mongoURI is missing from .env');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = { connectDb };
