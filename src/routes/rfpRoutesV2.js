// src/routes/rfpRoutes.js
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { listRfps, getRfp, createRfp, getRfpHistory, getRfpFull, getRfpsList } from '../controllers/rfpController.js';

const router = express.Router();

router.get('/', asyncHandler(listRfps));
router.get("/history", asyncHandler(getRfpHistory));
router.get('/:id', asyncHandler(getRfp));
router.post('/', asyncHandler(createRfp));
router.get('/:id/full', asyncHandler(getRfpFull));
router.get("/get/rfplist", asyncHandler(getRfpsList));

export default router;