// src/middleware/errorHandler.js
import mongoose from 'mongoose';
import { errorResponse } from '../utils/apiResponse.js';

export default function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    return errorResponse(res, { error: 'Validation error', errorCode: 'VALIDATION_ERROR', status: 400 });
  }

  // CastError (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return errorResponse(res, { error: 'Invalid id format', errorCode: 'INVALID_ID', status: 400 });
  }

  // Custom error with status
  if (err && err.statusCode) {
    return errorResponse(res, { error: err.message || 'Error', status: err.statusCode, errorCode: err.code || null });
  }

  // Default 500
  return errorResponse(res, { error: err?.message || 'Internal Server Error', status: 500 });
}