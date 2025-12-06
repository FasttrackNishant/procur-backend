import express from 'express';
import Rfp from '../models/Rfp.js';
import Vendor from '../models/Vendor.js';
import Proposal from '../models/Proposal.js';
import {
	createStructuredRfpFromText,
	compareProposalsWithExplanation,
} from '../services/aiService.js';
import { sendRfpEmail } from '../services/emailService.js';
import mongoose from 'mongoose';

const router = express.Router();

// Create RFP from natural language
router.post('/from-text', async (req, res) => {
	try {
		const { text } = req.body;
		if (!text) {
			return res.status(400).json({ error: 'text is required' });
		}

		const structured = await createStructuredRfpFromText(text);

		const rfp = await Rfp.create({
			title: structured.title || 'Untitled RFP',
			naturalLanguageRequest: text,
			budget: structured.budget,
			currency: structured.currency || 'USD',
			deliveryTimeline: structured.deliveryTimeline,
			paymentTerms: structured.paymentTerms,
			warranty: structured.warranty,
			items: structured.items || [],
		});

		res.status(201).json(rfp);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to create RFP from text' });
	}
});

// Basic CRUD
router.get('/', async (req, res) => {
	const rfps = await Rfp.find().sort({ createdAt: -1 });
	res.json(rfps);
});

router.get('/:id', async (req, res) => {
	const rfp = await Rfp.findById(req.params.id);
	if (!rfp) return res.status(404).json({ error: 'RFP not found' });
	res.json(rfp);
});

router.post('/:id/send', async (req, res) => {
	const rfpId = req.params.id;
	const { vendorIds } = req.body || {};

	// validation
	if (!mongoose.Types.ObjectId.isValid(rfpId)) {
		return res.status(400).json({ ok: false, error: 'Invalid RFP id' });
	}
	if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
		return res
			.status(400)
			.json({ ok: false, error: 'vendorIds array is required' });
	}

	const validVendorIds = vendorIds.filter((id) =>
		mongoose.Types.ObjectId.isValid(id)
	);
	if (validVendorIds.length === 0) {
		return res
			.status(400)
			.json({ ok: false, error: 'No valid vendorIds provided' });
	}

	const rfp = await Rfp.findById(rfpId);
	if (!rfp)
		return res.status(404).json({ ok: false, error: 'RFP not found' });

	// fetch vendor docs
	const vendors = await Vendor.find({ _id: { $in: validVendorIds } }).lean();

	// prepare email content (you can personalize per vendor if needed)
	const subject = `RFP: ${rfp.title}`;
	const bodyLines = [
		`You are invited to submit a proposal for the following RFP:`,
		``,
		`Title: ${rfp.title}`,
		`Budget: ${
			rfp.budget ? `${rfp.budget} ${rfp.currency}` : 'Not specified'
		}`,
		`Delivery timeline: ${rfp.deliveryTimeline || 'Not specified'}`,
		`Payment terms: ${rfp.paymentTerms || 'Not specified'}`,
		`Warranty: ${rfp.warranty || 'Not specified'}`,
		``,
		'Items:',
		...(rfp.items || []).map(
			(i, idx) =>
				`${idx + 1}. ${i.quantity || ''} x ${i.name} - ${i.specs || ''}`
		),
		``,
		'Please reply to this email with your detailed proposal including pricing, delivery timeline, payment terms, and warranty.',
	];
	const bodyText = bodyLines.join('\n');

	
	const existingKeys = new Set(
		(rfp.vendors || []).map((v) => String(v.vendorId || v.email || v.name))
	);

	const sendResults = [];
	const toAdd = [];

	for (const v of vendors) {
		if (!v.email) {
			sendResults.push({
				vendorId: String(v._id),
				name: v.name || null,
				email: null,
				ok: false,
				error: 'Vendor has no email',
			});
			continue;
		}

		try {
			const info = await sendRfpEmail({
				to: v.email,
				subject,
				body: bodyText,
			});

			sendResults.push({
				vendorId: String(v._id),
				name: v.name,
				email: v.email,
				ok: true,
				messageId: info?.messageId || info?.id || null,
			});

      console.log("send rslt",sendResults)
				toAdd.push({
					vendorId: v._id,
				});

		} catch (err) {
			console.error('send error for vendor', v._id, err);
			sendResults.push({
				vendorId: String(v._id),
				name: v.name || null,
				email: v.email || null,
				ok: false,
				error: err?.message || String(err),
			});
		}
	}

	// atomically push new vendors and increment vendorsSent if we have additions
	if (toAdd.length > 0) {
  console.log('vendors', toAdd);
  const result = await Rfp.findByIdAndUpdate(
    rfpId,
    {
      $push: { 
        vendors: { 
          $each: toAdd.map(({ vendorId }) => ({ vendorId }))  // Explicit wrapper
        } 
      },
      $set: { status: 'sent' },
    },
    { 
      new: true,
      runValidators: true  // Enforce schema validation
    }
  );
  
  console.log('Update result:', result?.vendors?.length); // Debug
}
 else {
		const anyOk = sendResults.some((r) => r.ok === true);
		if (anyOk && rfp.status !== 'sent') {
			rfp.status = 'sent';
			await rfp.save();
		}
	}

	return res.json({
		ok: true,
		message: 'Send completed',
		sentCount: sendResults.filter((r) => r.ok).length,
		results: sendResults,
	});
});

// Get proposals for an RFP with AI comparison
router.get('/:id/proposals/comparison', async (req, res) => {
	try {
		const rfp = await Rfp.findById(req.params.id);
    console.log(rfp)
		if (!rfp) return res.status(404).json({ error: 'RFP not found' });

		const proposals = await Proposal.find({ rfp: rfp._id }).populate(
			'vendor'
		);
    console.log(proposals)
		if (proposals.length === 0) {
			return res.json({ proposals: [], comparison: null });
		}

		const comparison = await compareProposalsWithExplanation(
			rfp.toObject(),
			proposals
		);

		console.log('log 2', comparison);
		res.json({ proposals, comparison });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Failed to compare proposals' });
	}
});

export default router;
