// src/routes/inbound.js
import express from 'express';
import multer from 'multer';
import Proposal from '../models/Proposal.js';
import Rfp from '../models/Rfp.js';
import Vendor from '../models/Vendor.js';
import { parseVendorProposalEmail } from '../services/aiService.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

/**
 * Inbound webhook for SendGrid Inbound Parse (no attachment/PDF processing).
 * Expects emails sent to: rfp+<rfpId>+<vendorId>@your-domain
 */
router.post('/inbound', upload.any(), async (req, res) => {
  try {
    const fields = req.body || {};
    // SendGrid fields: from, to, subject, text, html, headers, ...
    const from = fields.from || '';
    const to = fields.to || '';
    const subject = fields.subject || '';
    const text = fields.text || fields['text'] || ''; // plain text body

    console.log('[Inbound] from:', from);
    console.log('[Inbound] to:', to);
    console.log('[Inbound] subject:', subject);

    // parse rfpId and vendorId from the address: rfp+<rfpId>+<vendorId>@...
    let rfpId = null;
    let vendorId = null;
    const toLower = String(to).toLowerCase();
    const match = toLower.match(/rfp\+([a-f0-9]+)\+([a-f0-9]+)@/i);

    if (match) {
      rfpId = match[1];
      vendorId = match[2];
      console.log('[Inbound] parsed rfpId:', rfpId, 'vendorId:', vendorId);
    } else {
      console.warn('[Inbound] Could not parse rfp/vendor ids from "to" address. Expecting rfp+<rfpId>+<vendorId>@domain');
      return res.status(400).json({ error: 'Missing or invalid rfp/vendor identifiers in recipient address.' });
    }

    // Validate RFP and Vendor exist (required by your Proposal schema)
    const [rfpDoc, vendorDoc] = await Promise.all([
      Rfp.findById(rfpId).lean().catch(() => null),
      Vendor.findById(vendorId).lean().catch(() => null),
    ]);

    if (!rfpDoc) {
      console.warn('[Inbound] RFP not found:', rfpId);
      return res.status(400).json({ error: `RFP not found: ${rfpId}` });
    }

    if (!vendorDoc) {
      console.warn('[Inbound] Vendor not found:', vendorId);
      return res.status(400).json({ error: `Vendor not found: ${vendorId}` });
    }

    // Build text to feed AI (subject + text). No attachment/PDF logic per request.
    const combinedParts = [];
    if (subject) combinedParts.push(`Subject: ${subject}`);
    if (text) combinedParts.push(`Body:\n${text}`);
    const fullTextForAI = combinedParts.join('\n\n').trim();

    if (!fullTextForAI) {
      console.warn('[Inbound] Empty email body for AI to parse.');
      return res.status(400).json({ error: 'Empty email body.' });
    }

    // Call AI extractor service
    let extracted = {};
    try {
      extracted = await parseVendorProposalEmail(fullTextForAI);
      console.log('[Inbound] AI extraction result:', extracted);
    } catch (err) {
      console.error('[Inbound] AI extraction error:', err?.message || err);
      return res.status(500).json({ error: 'AI extraction failed', detail: err?.message || String(err) });
    }

    // Map AI output into your Proposal schema fields (safe defaults)
    const proposalDoc = new Proposal({
      rfp: rfpId,
      vendor: vendorId,
      rawEmail: `Subject: ${subject || ''}\n\n${text || ''}`,
      currency: extracted.currency || 'USD',
      totalPrice: typeof extracted.totalPrice === 'number' ? extracted.totalPrice : null,
      deliveryTimeline: extracted.deliveryTimeline || null,
      paymentTerms: extracted.paymentTerms || null,
      warranty: extracted.warranty || null,
      aiSummary: extracted.aiSummary || null,
      aiScore: typeof extracted.aiScore === 'number' ? extracted.aiScore : null,
      items: Array.isArray(extracted.items)
        ? extracted.items.map((it) => ({
            name: it.name || '',
            quantity: typeof it.quantity === 'number' ? it.quantity : (it.quantity ? Number(it.quantity) : null),
            unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : (it.unitPrice ? Number(it.unitPrice) : null),
            totalPrice: typeof it.totalPrice === 'number' ? it.totalPrice : (it.totalPrice ? Number(it.totalPrice) : null),
            notes: it.notes || '',
          }))
        : [],
      status: 'received',
    });

    await proposalDoc.save();

    console.log('[Inbound] Proposal saved with id:', proposalDoc._id);

    return res.status(201).json({ ok: true, proposalId: proposalDoc._id });
  } catch (err) {
    console.error('[Inbound] unexpected error:', err);
    return res.status(500).json({ error: err?.message || 'Inbound processing failed' });
  }
});

export default router;