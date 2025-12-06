// scripts/seed.mjs
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// adjust these import paths if your models are located elsewhere
import Rfp from '../models/Rfp.js';
import Vendor from '../models/Vendor.js';
import Proposal from '../models/Proposal.js';

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rfp_db_seed';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);

    // ---------- RFP seed ----------
    const rfpCount = await Rfp.countDocuments();
    if (rfpCount === 0) {
      const defaultRfp = await Rfp.create({
        title: 'Office IT Procurement — Laptops & Monitors (Default Seed)',
        naturalLanguageRequest:
          "I need to procure laptops and monitors for our new office. Budget is $50,000 total. Need delivery within 30 days. We need 20 laptops with 16GB RAM and 15 monitors 27-inch. Payment terms should be net 30, and we need at least 1 year warranty.",
        budget: 50000,
        currency: 'USD',
        deliveryTimeline: '30 days',
        paymentTerms: 'Net 30',
        warranty: '1 year',
        items: [
          { name: 'Laptop - 16GB RAM', quantity: 20, specs: '16GB RAM, 512GB SSD, i5 or equivalent' },
          { name: 'Monitor - 27 inch', quantity: 15, specs: '27-inch IPS, 1920x1080 or higher' }
        ],
        status: 'sent'
      });
      console.log('Inserted default RFP:', defaultRfp._id.toString());
    } else {
      console.log(`Rfp collection already has ${rfpCount} document(s). Skipping RFP seed.`);
    }

    // ---------- Vendor seed ----------
    const vendorCount = await Vendor.countDocuments();
    if (vendorCount === 0) {
      const vendors = [
        {
          name: 'Alpha Tech Supplies',
          email: 'sales@alphatech.example.com',
          company: 'Alpha Tech Supplies Pvt Ltd',
          categories: ['IT Hardware', 'Peripherals'],
          notes: 'Preferred vendor for corporate purchases'
        },
        {
          name: 'Delta Systems',
          email: 'procure@deltasystems.example.com',
          company: 'Delta Systems Ltd',
          categories: ['IT Hardware', 'Installation'],
          notes: 'Provides on-site installation and warranties'
        },
        {
          name: 'Omega Office Products',
          email: 'contact@omegaoffice.example.com',
          company: 'Omega Office Products',
          categories: ['Office Furniture', 'IT Hardware'],
          notes: 'Good pricing on bulk monitor purchases'
        }
      ];
      const insertedVendors = await Vendor.insertMany(vendors);
      console.log(`Inserted ${insertedVendors.length} default vendors.`);
    } else {
      console.log(`Vendor collection already has ${vendorCount} document(s). Skipping Vendor seed.`);
    }

    // ---------- Proposal seed ----------
    const proposalCount = await Proposal.countDocuments();
    if (proposalCount === 0) {
      // find one RFP and one vendor to link the proposal to
      const rfp = await Rfp.findOne({ title: /Office IT Procurement/i });
      const vendor = await Vendor.findOne({ name: /Alpha Tech Supplies/i }) || (await Vendor.findOne());

      if (rfp && vendor) {
        const sampleProposal = {
          rfp: rfp._id,
          vendor: vendor._id,
          rawEmail:
            'Dear Procurement,\n\nPlease find attached our proposal for 20 laptops and 15 monitors. Pricing and lead times enclosed.\n\nRegards,\nAlpha Tech Sales',
          currency: 'USD',
          totalPrice: 48500,
          deliveryTimeline: '25 days',
          paymentTerms: 'Net 30',
          warranty: '1 year manufacturer warranty',
          items: [
            { name: 'Laptop - 16GB RAM', quantity: 20, unitPrice: 1800, totalPrice: 36000, notes: 'Includes 512GB SSD' },
            { name: 'Monitor - 27 inch', quantity: 15, unitPrice: 820, totalPrice: 12300, notes: '3-year advance replacement' }
          ],
          aiSummary: 'Vendor offers full spec laptops and monitors within budget and 25 day delivery.',
          aiScore: 87,
          status: 'received'
        };

        const createdProposal = await Proposal.create(sampleProposal);
        console.log('Inserted default Proposal:', createdProposal._id.toString());
      } else {
        console.log('Could not find both RFP and Vendor to create a sample Proposal. Skipping Proposal seed.');
      }
    } else {
      console.log(`Proposal collection already has ${proposalCount} document(s). Skipping Proposal seed.`);
    }

    // Optional: if you want a persistent flag instead of counts, you can create a "Migrations" or "Seed" collection
    // and set a document there. This script uses the "collection-is-empty" approach which is simpler and safe.

    console.log('Seeding completed.');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Exiting.');
    process.exit(0);
  }
}

seed();