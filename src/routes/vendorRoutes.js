import express from 'express';
import Vendor from '../models/Vendor.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const vendors = await Vendor.find()
    .sort({ createdAt: -1 })
    .select("name company email");

  res.json(vendors);
});

router.post('/', async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json(vendor);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create vendor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/:id', async (req, res) => {
  await Vendor.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

export default router;


