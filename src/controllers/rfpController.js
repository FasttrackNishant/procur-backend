import mongoose from 'mongoose';
import Rfp from '../models/Rfp.js';
import Proposal from '../models/Proposal.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export async function listRfps(req, res) {
	const { page = 1, limit = 20, q, status, sort = '-createdAt' } = req.query;

	const pageNum = Math.max(1, Number(page));
	const lim = Math.max(1, Math.min(200, Number(limit)));
	const skip = (pageNum - 1) * lim;

	// Build match stage
	const match = {};
	if (status) match.status = status;
	if (q) {
		const regex = new RegExp(String(q).trim(), 'i');
		match.$or = [{ title: regex }, { naturalLanguageRequest: regex }];
	}

	// Aggregation: join proposals to count proposalsReceived
	const pipeline = [
		{ $match: match },
		// lookup proposals count
		{
			$lookup: {
				from: 'proposals',
				localField: '_id',
				foreignField: 'rfp',
				as: 'proposals',
			},
		},
		{
			$addFields: {
				proposalsReceived: { $size: '$proposals' },
			},
		},
		{
			$project: {
				proposals: 0, // remove the array to keep payload small
			},
		},
		// sort
		{
			$sort:
				sort === 'createdAt' ||
				sort === '-createdAt' ||
				sort === 'budget' ||
				sort === '-budget'
					? sort[0] === '-'
						? { [sort.slice(1)]: -1 }
						: { [sort]: 1 }
					: { createdAt: -1 },
		},
		{ $skip: skip },
		{ $limit: lim },
	];

	try {
		const [items, total] = await Promise.all([
			Rfp.aggregate(pipeline).exec(),
			Rfp.countDocuments(match),
		]);

		// Normalize fields to match frontend expectations (id, title, description, budget etc)
		const data = items.map((r) => ({
			id: r._id.toString(),
			title: r.title,
			naturalLanguageRequest: r.naturalLanguageRequest,
			description: r.naturalLanguageRequest?.slice(0, 220) || '',
			budget: r.budget ?? null,
			currency: r.currency ?? 'USD',
			status: r.status,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			items: r.items || [],
			proposalsReceived: r.proposalsReceived ?? 0,
		}));

		return successResponse(res, {
			data,
			meta: { total, page: pageNum, limit: lim },
		});
	} catch (err) {
		console.error('listRfps error', err);
		return errorResponse(res, {
			error: err.message || 'Failed to list RFPs',
			status: 500,
		});
	}
}

/**
 * GET /api/rfps/:id
 * Return the RFP with basic details and list of proposals (optional)
 * Query param `withProposals=true` to include proposals (paginated)
 */
export async function getRfp(req, res) {
	const { id } = req.params;
	const {
		withProposals = 'false',
		proposalsPage = 1,
		proposalsLimit = 20,
	} = req.query;

	if (!mongoose.Types.ObjectId.isValid(id)) {
		return errorResponse(res, { error: 'Invalid RFP id', status: 400 });
	}

	try {
		const rfp = await Rfp.findById(id).lean();
		if (!rfp)
			return errorResponse(res, { error: 'RFP not found', status: 404 });

		const result = {
			id: rfp._id.toString(),
			title: rfp.title,
			naturalLanguageRequest: rfp.naturalLanguageRequest,
			budget: rfp.budget ?? null,
			currency: rfp.currency ?? 'USD',
			deliveryTimeline: rfp.deliveryTimeline || null,
			paymentTerms: rfp.paymentTerms || null,
			warranty: rfp.warranty || null,
			items: rfp.items || [],
			status: rfp.status,
			createdAt: rfp.createdAt,
			updatedAt: rfp.updatedAt,
		};

		if (String(withProposals).toLowerCase() === 'true') {
			const pageNum = Math.max(1, Number(proposalsPage));
			const lim = Math.max(1, Math.min(200, Number(proposalsLimit)));
			const skip = (pageNum - 1) * lim;

			const [total, docs] = await Promise.all([
				Proposal.countDocuments({ rfp: id }),
				Proposal.find({ rfp: id })
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(lim)
					.populate({ path: 'vendor', select: 'name email company' })
					.lean(),
			]);

			const proposals = docs.map((p) => ({
				id: p._id.toString(),
				vendor: p.vendor
					? {
							id: p.vendor._id.toString(),
							name: p.vendor.name,
							email: p.vendor.email,
							company: p.vendor.company,
					  }
					: null,
				receivedAt: p.createdAt,
				aiScore: p.aiScore ?? null,
				aiSummary: p.aiSummary ?? null,
				totalPrice: p.totalPrice ?? null,
				currency: p.currency ?? 'USD',
				status: p.status,
				items: p.items || [],
			}));

			result.proposals = proposals;
			result.proposalsMeta = { total, page: pageNum, limit: lim };
		} else {
			// always include proposalsReceived count for convenience
			const count = await Proposal.countDocuments({ rfp: id });
			result.proposalsReceived = count;
		}

		return successResponse(res, { data: result });
	} catch (err) {
		console.error('getRfp error', err);
		return errorResponse(res, {
			error: err.message || 'Failed to load RFP',
			status: 500,
		});
	}
}

/**
 * POST /api/rfps
 * Create a new RFP
 */
export async function createRfp(req, res) {
	const body = req.body || {};
	const {
		title,
		naturalLanguageRequest,
		budget,
		currency = 'USD',
		deliveryTimeline,
		paymentTerms,
		warranty,
		items,
	} = body;

	if (!title || !naturalLanguageRequest) {
		return errorResponse(res, {
			error: 'title and naturalLanguageRequest are required',
			status: 400,
		});
	}

	try {
		const rfp = new Rfp({
			title,
			naturalLanguageRequest,
			budget: budget ?? null,
			currency,
			deliveryTimeline: deliveryTimeline || null,
			paymentTerms: paymentTerms || null,
			warranty: warranty || null,
			items: Array.isArray(items)
				? items.map((it) => ({
						name: it.name || '',
						quantity: it.quantity ?? null,
						specs: it.specs || '',
				  }))
				: [],
		});

		await rfp.save();
		return successResponse(res, {
			data: rfp,
			status: 201,
			message: 'RFP created',
		});
	} catch (err) {
		console.error('createRfp error', err);
		return errorResponse(res, {
			error: err.message || 'Failed to create RFP',
			status: 500,
		});
	}
}

export async function getRfpHistory(req, res) {
	try {
		// Load all RFPs, newest first
		const rfps = await Rfp.find().sort({ createdAt: -1 }).lean();
        console.log(rfps)
		// For each RFP, count proposals
		const result = await Promise.all(
			rfps.map(async (r) => {
				const proposalsCount = await Proposal.countDocuments({
					rfp: r._id,
				});

                console.log(proposalsCount)


				return {
					id: r._id.toString(),
					title: r.title,
					description: r.naturalLanguageRequest?.slice(0, 120) || '',
					budget: r.budget ?? null,
					status: r.status,
					created: r.createdAt.toISOString().split('T')[0], // yyyy-mm-dd
					proposalsReceived: proposalsCount,
				};
			})
		);

		return successResponse(res, {
			data: result,
			message: 'RFP history loaded',
		});
	} catch (err) {
		console.error('getRfpHistory error:', err);
		return errorResponse(res, {
			error: err.message || 'Failed to load RFP history',
			status: 500,
		});
	}
}

//  RFP Full

/**
 * GET /api/rfps/:id/full
 * Returns a full RFP object including:
 * - id, title, description, budget, status, created
 * - vendors: either embedded on RFP or derived from proposals (unique)
 * - proposals: list of proposals with vendorName, aiScore, parsed: { summary, pricing, terms, delivery, items }
 */
export async function getRfpFull(req, res) {
	try {
		let { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return errorResponse(res, { error: 'Invalid RFP id', status: 400 });
		}

		// load RFP
		const rfp = await Rfp.findById(id).lean();
		if (!rfp)
			return errorResponse(res, { error: 'RFP not found', status: 404 });

		// load proposals, populate vendor info
		const proposalsDocs = await Proposal.find({ rfp: id })
			.sort({ createdAt: -1 })
			.populate({ path: 'vendor', select: 'name email company' })
			.lean();

		// map proposals to UI shape
		const proposals = proposalsDocs.map((p) => {
			// attempt to extract parsed fields from stored items/aiSummary/aiScore
			const parsed = {
				summary: p.aiSummary || null,
				pricing: {
					total:
						p.totalPrice != null
							? typeof p.totalPrice === 'number'
								? `$${p.totalPrice}`
								: p.totalPrice
							: null,
					monthly: null,
					setupFee: null,
				},
				terms: [],
				delivery: p.deliveryTimeline || null,
				items: Array.isArray(p.items)
					? p.items.map((it) => ({
							name: it.name || '',
							quantity: it.quantity ?? null,
							unitPrice: it.unitPrice ?? null,
							totalPrice: it.totalPrice ?? null,
							notes: it.notes || '',
					  }))
					: [],
			};

			// If items present and total can be computed, fill pricing.monthly
			if (Array.isArray(p.items) && p.items.length > 0) {
				const totalFromItems = p.items.reduce(
					(s, it) => s + (Number(it.totalPrice || 0) || 0),
					0
				);
				if (totalFromItems > 0 && !parsed.pricing.total) {
					parsed.pricing.total = `$${totalFromItems}`;
				}
				if (totalFromItems > 0) {
					parsed.pricing.monthly = `$${
						Math.round((totalFromItems / 12) * 100) / 100
					}`;
				}
			} else if (
				p.totalPrice != null &&
				typeof p.totalPrice === 'number'
			) {
				parsed.pricing.monthly = `$${
					Math.round((p.totalPrice / 12) * 100) / 100
				}`;
			}

			// terms: paymentTerms, warranty, any other short fields
			if (p.paymentTerms) parsed.terms.push(p.paymentTerms);
			if (p.warranty) parsed.terms.push(p.warranty);

			// vendorName: prefer populated vendor name, else fallback to vendor field if string
			const vendorName =
				p.vendor?.name ||
				(p.vendor && typeof p.vendor === 'string'
					? p.vendor
					: 'Unknown Vendor');

			return {
				id: p._id.toString(),
				vendorId: p.vendor?._id?.toString?.() || null,
				vendorName,
				aiScore: typeof p.aiScore === 'number' ? p.aiScore : null,
				parsed,
				rawEmail: p.rawEmail || '',
				receivedAt: p.createdAt,
				status: p.status || 'received',
			};
		});

		const rfpList = await Rfp.findById(id)
			.populate({
				path: 'vendors.vendorId',
				select: 'name email company',
			})
			.lean();

		if (!rfpList) throw new Error('RFP not found');

        console.log(rfpList)

		const vendors = (rfpList.vendors || []).map((v) => ({
			id: v.vendorId?._id
				? String(v.vendorId._id)
				: v.vendorId
				? String(v.vendorId)
				: null,
			name: v.vendorId?.name || '',
			email: v.vendorId?.email || '',
			company: v.vendorId?.company || '',
		}));

		console.log('Vendors from RFP:', vendors);

		const out = {
			id: rfp._id.toString(),
			title: rfp.title,
			budget:
				rfp.budget != null
					? typeof rfp.budget === 'number'
						? `${rfp.budget} USD`
						: rfp.budget
					: null,
			status: rfp.status,
            deliveryTimeline : rfp.deliveryTimeline,
            paymentTerms : rfp.paymentTerms,
            warranty : rfp.warranty,
			created: rfp.createdAt
				? new Date(rfp.createdAt).toLocaleString()
				: null,
			vendorsSent:
				(rfp.vendors && rfp.vendors.length) || vendors.length || 0,
			proposalsReceived: proposals.length,
			description: rfp.naturalLanguageRequest || '',
			vendors,
			proposals,
		};

		return successResponse(res, { data: out, message: 'RFP full loaded' });
	} catch (err) {
		console.error('getRfpFull error', err);
		return errorResponse(res, {
			error: err.message || 'Failed to load RFP full',
			status: 500,
		});
	}
}


export async function getRfpsList(req, res) {
    try {
        const rfps = await Rfp.find({}, 'title _id').lean();
        
        const rfpList = rfps.map(rfp => ({
            id: rfp._id.toString(),
            name: rfp.title
        }));

        return successResponse(res, {
            data: rfpList
        });
    } catch (error) {
        console.error('RFP list error:', error);
        return errorResponse(res, {
            error: 'Failed to fetch RFPs',
            status: 500
        });
    }
}
