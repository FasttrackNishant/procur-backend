import mongoose from 'mongoose';
import Proposal from '../models/Proposal.js';
import Vendor from '../models/Vendor.js';
import Rfp from '../models/Rfp.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { parseVendorProposalEmail } from '../services/aiService.js';

// List proposals with filters & pagination
export async function listProposals(req, res) {
  const { rfpId, vendorId, status, page = 1, limit = 100 } = req.query;
  const q = {};
  if (rfpId && mongoose.Types.ObjectId.isValid(rfpId)) q.rfp = rfpId;
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) q.vendor = vendorId;
  if (status) q.status = status;

  const pageNum = Math.max(1, Number(page));
  const lim = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNum - 1) * lim;

  const [total, docs] = await Promise.all([
    Proposal.countDocuments(q),
    Proposal.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate({ path: 'vendor', select: 'name email company' })
      .populate({ path: 'rfp', select: 'title' })
      .lean()
  ]);

  const data = docs.map((p) => ({
    id: p._id,
    rfp: { id: p.rfp?._id ?? null, title: p.rfp?.title ?? 'Untitled RFP' },
    vendor: { id: p.vendor?._id ?? null, name: p.vendor?.name ?? 'Unknown', email: p.vendor?.email ?? null, company: p.vendor?.company ?? null },
    receivedAt: p.createdAt,
    aiScore: p.aiScore ?? null,
    aiSummary: p.aiSummary ?? null,
    totalPrice: p.totalPrice ?? null,
    currency: p.currency ?? 'USD',
    status: p.status
  }));

  return successResponse(res, { data, meta: { total, page: pageNum, limit: lim } });
}

// Get single proposal
export async function getProposal(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, { error: 'Invalid proposal id', status: 400 });

  const p = await Proposal.findById(id)
    .populate({ path: 'vendor', select: 'name email company' })
    .populate({ path: 'rfp', select: 'title naturalLanguageRequest' })
    .lean();

  if (!p) return errorResponse(res, { error: 'Proposal not found', status: 404 });
  return successResponse(res, { data: p });
}

// Create (for tests or inbound fallback)
export async function createProposal(req, res) {
  const body = req.body || {};
  const { rfp, vendor } = body;
  if (!rfp || !vendor) return errorResponse(res, { error: 'rfp and vendor are required', status: 400 });

  if (!mongoose.Types.ObjectId.isValid(rfp) || !mongoose.Types.ObjectId.isValid(vendor)) {
    return errorResponse(res, { error: 'Invalid rfp or vendor id', status: 400 });
  }

  // Ensure existence
  const [rfpDoc, vendorDoc] = await Promise.all([
    Rfp.findById(rfp).lean().catch(() => null),
    Vendor.findById(vendor).lean().catch(() => null)
  ]);

  if (!rfpDoc) return errorResponse(res, { error: 'RFP not found', status: 400 });
  if (!vendorDoc) return errorResponse(res, { error: 'Vendor not found', status: 400 });

  const toSave = {
    rfp,
    vendor,
    rawEmail: body.rawEmail || '',
    currency: body.currency || 'USD',
    totalPrice: body.totalPrice ?? null,
    deliveryTimeline: body.deliveryTimeline || null,
    paymentTerms: body.paymentTerms || null,
    warranty: body.warranty || null,
    aiSummary: body.aiSummary || null,
    aiScore: typeof body.aiScore === 'number' ? body.aiScore : null,
    items: Array.isArray(body.items) ? body.items.map(it => ({
      name: it.name || '',
      quantity: it.quantity ?? null,
      unitPrice: it.unitPrice ?? null,
      totalPrice: it.totalPrice ?? null,
      notes: it.notes || ''
    })) : []
  };

  const p = new Proposal(toSave);
  await p.save();
  return successResponse(res, { data: p, status: 201, message: 'Proposal created' });
}

// Update status
export async function updateProposalStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse(res, { error: 'Invalid id', status: 400 });
  if (!status || !['received','shortlisted','rejected','awarded'].includes(status)) {
    return errorResponse(res, { error: 'Invalid status', status: 400 });
  }

  const updated = await Proposal.findByIdAndUpdate(id, { status }, { new: true })
    .populate({ path: 'vendor', select: 'name email company' })
    .populate({ path: 'rfp', select: 'title' })
    .lean();

  if (!updated) return errorResponse(res, { error: 'Proposal not found', status: 404 });
  return successResponse(res, { data: updated, message: 'Status updated' });
}

export async function createProposalManual(req, res) {
    try {
        const { rfpId, vendorId, text } = req.body;

        if (!rfpId || !mongoose.Types.ObjectId.isValid(rfpId)) {
            return errorResponse(res, { error: 'Valid rfpId required', status: 400 });
        }
        if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
            return errorResponse(res, { error: 'Valid vendorId required', status: 400 });
        }
        if (!text || !text.trim()) {
            return errorResponse(res, { error: 'Email text required', status: 400 });
        }

        const [rfpDoc, vendorDoc] = await Promise.all([
            Rfp.findById(rfpId).lean(),
            Vendor.findById(vendorId).lean()
        ]);

        if (!rfpDoc) return errorResponse(res, { error: `RFP not found: ${rfpId}`, status: 404 });
        if (!vendorDoc) return errorResponse(res, { error: `Vendor not found: ${vendorId}`, status: 404 });

        const fullTextForAI = `Proposal Email:\n\n${text.trim()}`;
        let extracted;
        try {
            extracted = await parseVendorProposalEmail(fullTextForAI);
            console.log('[Manual-Simple] AI extraction:', extracted);
        } catch (err) {
            console.error('[Manual-Simple] AI failed:', err);
            // Fallback: use raw text only
            extracted = {
                currency: 'USD',
                totalPrice: null,
                deliveryTimeline: null,
                paymentTerms: null,
                warranty: null,
                aiSummary: text.slice(0, 500) + '...',
                aiScore: null,
                items: []
            };
        }

        const proposal = new Proposal({
            rfp: rfpId,
            vendor: vendorId,
            rawEmail: text.trim(),
            currency: extracted.currency || 'USD',
            totalPrice: typeof extracted.totalPrice === 'number' ? extracted.totalPrice : null,
            deliveryTimeline: extracted.deliveryTimeline || null,
            paymentTerms: extracted.paymentTerms || null,
            warranty: extracted.warranty || null,
            aiSummary: extracted.aiSummary || null,
            aiScore: typeof extracted.aiScore === 'number' ? extracted.aiScore : null,
            items: Array.isArray(extracted.items) 
                ? extracted.items.map(item => ({
                    name: String(item.name || '').trim(),
                    quantity: Number(item.quantity) || 1,
                    unitPrice: Number(item.unitPrice) || 0,
                    totalPrice: Number(item.totalPrice) || 0,
                    notes: String(item.notes || '').trim()
                })).filter(item => item.name)
                : [],
            status: 'received'
        });

        await proposal.save();

        console.log(`[Manual-Simple] Proposal created: ${proposal._id}`);

        return successResponse(res, {
            data: {
                id: proposal._id,
                vendorName: vendorDoc.name,
                rfpTitle: rfpDoc.title,
                extracted: {
                    totalPrice: proposal.totalPrice,
                    itemsCount: proposal.items.length,
                    aiScore: proposal.aiScore,
                    currency: proposal.currency
                }
            },
            message: 'Proposal created with AI extraction',
            status: 201
        });

    } catch (error) {
        console.error('[Manual-Simple] Error:', error);
        return errorResponse(res, {
            error: error.message || 'Proposal creation failed',
            status: 500
        });
    }
}