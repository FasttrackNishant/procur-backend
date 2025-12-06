import dotenv from 'dotenv'
dotenv.config();

import { GoogleGenAI } from '@google/genai';

let apiKey = process.env.GEMINI_API_KEY;
console.log("gemini key",apiKey)

const client = new GoogleGenAI({ apiKey: apiKey });

async function runChat(messages) {
	if (!client) {
		throw new Error('API_KEY is not configured');
	}

	const geminiMessages = messages.map((m) => ({
		role: m.role,
		parts: [{ text: m.content }],
	}));

	console.log('log testig ');
	console.log(geminiMessages[1].parts);

	const response = await client.models.generateContent({
		model: 'gemini-2.5-flash',
		contents: geminiMessages,
	});

  const cleaned = cleanJsonString(response.text);
	console.log(cleaned);
	return cleaned;
}

export async function createStructuredRfpFromText(text) {
	const prompt = `
You are helping a procurement manager turn a free-form purchasing request into a structured RFP JSON.

Return ONLY valid JSON with this shape (no markdown):
{
  "title": string,
  "budget": number | null,
  "currency": "USD",
  "deliveryTimeline": string | null,
  "paymentTerms": string | null,
  "warranty": string | null,
  "items": [
    { "name": string, "quantity": number | null, "specs": string | null }
  ]
}

If a field is missing, use null or an empty array where appropriate.

Free-form request:
"""${text}"""`;

	const content = await runChat([
		{
			role: 'model',
			content:
				'You are a precise procurement assistant that only returns JSON.',
		},
		{ role: 'user', content: prompt },
	]);

	return JSON.parse(content);
}

function cleanJsonString(str) {
	return str
		.replace(/```json/g, '')
		.replace(/```/g, '')
		.trim();
}

export async function parseVendorProposalEmail(emailBody) {
	const prompt = `
You will receive the body of an email from a vendor responding to an RFP.
Extract key commercial terms into the following JSON structure:
{
  "currency": "USD",
  "totalPrice": number | null,
  "deliveryTimeline": string | null,
  "paymentTerms": string | null,
  "warranty": string | null,
  "items": [
    { "name": string, "quantity": number | null, "unitPrice": number | null, "totalPrice": number | null, "notes": string | null }
  ]
}

Return ONLY JSON, no explanations.

Email body:
"""${emailBody}"""`;

	const content = await runChat([
		{
			role: 'model',
			content:
				'You are a precise procurement assistant that only returns JSON.',
		},
		{ role: 'user', content: prompt },
	]);

	return JSON.parse(content);
}

export async function compareProposalsWithExplanation(rfp, proposals) {
	const prompt = `
You are helping a procurement manager choose a vendor for this RFP.

RFP (JSON):
${JSON.stringify(rfp)}

Vendor proposals (JSON array):
${JSON.stringify(
	proposals.map((p) => ({
		id: p._id,
		vendorName: p.vendor?.name,
		totalPrice: p.totalPrice,
		deliveryTimeline: p.deliveryTimeline,
		paymentTerms: p.paymentTerms,
		warranty: p.warranty,
	}))
)}

For each proposal, assign a score from 0-100 where higher is better,
considering price, delivery, terms, and warranty. in overallSummary dont add proposalid insted use vendor name and company name  and give name of recommendedProposal and id of recommendedProposalId


Return ONLY valid JSON with this shape :
{
  "scores": [
    { "proposalId": string, "score": number, "rationale": string }
  ],
  "recommendedProposalName": string,
   "recommendedProposalId": string,
  "overallSummary": string
}`;

	const content = await runChat([
		{
			role: 'model',
			content:
				'You are a senior procurement analyst helping compare vendor proposals. Return only JSON.',
		},
		{ role: 'user', content: prompt },
	]);
	console.log('log 1');
	console.log(content);
	return JSON.parse(content);
}
