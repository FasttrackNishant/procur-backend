import express from 'express';
import Vendor from '../models/Vendor.js';
import Rfp from '../models/Rfp.js';
import Proposal from '../models/Proposal.js';
import { parseVendorProposalEmail } from '../services/aiService.js';

const router = express.Router();

router.post('/testinbound', async (req, res) => {
  try {
    const { fromEmail, rfpId, subject, text } = req.body;
    if (!fromEmail || !rfpId || !text) {
      return res.status(400).json({ error: 'fromEmail, rfpId and text are required' });
    }

    const rfp = await Rfp.findById(rfpId);
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });

    const vendor = await Vendor.findOne({ email: fromEmail.toLowerCase() });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found for this email' });

    console.log("here is use")

    const parsed = await parseVendorProposalEmail(text);

    const proposal = await Proposal.create({
      rfp: rfp._id,
      vendor: vendor._id,
      rawEmail: `Subject: ${subject || ''}\n\n${text}`,
      ...parsed
    });

    res.status(201).json(proposal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process inbound email' });
  }
});

export default router;


