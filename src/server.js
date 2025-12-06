import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import app from './app.js';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/procurai';
console.log(MONGO_URI)
async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: true,
    });

    console.log(' Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(` Backend running at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error(' MongoDB connection error:', err.message);
    process.exit(1);
  }
}

start();