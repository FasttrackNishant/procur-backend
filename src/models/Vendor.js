import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String },
    categories: [{ type: String }],
    notes: { type: String }
  },
  { timestamps: true }
);

const Vendor = mongoose.model('Vendor', VendorSchema);

export default Vendor;


