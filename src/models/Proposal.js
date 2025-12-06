import mongoose from 'mongoose';

const ProposalItemSchema = new mongoose.Schema(
  {
    name: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    notes: String
  },
  { _id: false }
);

const ProposalSchema = new mongoose.Schema(
  {
    rfp: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfp', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    rawEmail: { type: String },
    currency: { type: String, default: 'USD' },
    totalPrice: { type: Number },
    deliveryTimeline: { type: String },
    paymentTerms: { type: String },
    warranty: { type: String },
    items: [ProposalItemSchema],
    aiSummary: { type: String },
    aiScore: { type: Number },
    status: {
      type: String,
      enum: ['received', 'shortlisted', 'rejected', 'awarded'],
      default: 'received'
    }
  },
  { timestamps: true }
);

const Proposal = mongoose.model('Proposal', ProposalSchema);

export default Proposal;


