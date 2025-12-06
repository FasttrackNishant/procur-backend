import mongoose from 'mongoose';

const RfpItemSchema = new mongoose.Schema(
  {
    name: String,
    quantity: Number,
    specs: String
  },
  { _id: false }
);

const RfpVendorSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: false },
  },
  { _id: false }
);


const RfpSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    naturalLanguageRequest: { type: String, required: true },
    budget: { type: Number },
    currency: { type: String, default: 'USD' },
    deliveryTimeline: { type: String },
    paymentTerms: { type: String },
    warranty: { type: String },
    items: [RfpItemSchema],
    status: {
      type: String,
      enum: ['draft', 'sent', 'closed'],
      default: 'draft'
    },
    vendors: { type: [RfpVendorSchema], default: [] },
  },
  { timestamps: true }
);

const Rfp = mongoose.model('Rfp', RfpSchema);

export default Rfp;


