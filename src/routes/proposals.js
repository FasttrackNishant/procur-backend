// src/routes/proposals.js
import express from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { createProposalManual, listProposals } from '../controllers/proposalsController.js';

const router = express.Router();

router.get('/', asyncHandler(listProposals));
router.post('/createProposal', asyncHandler(createProposalManual));

export default router;