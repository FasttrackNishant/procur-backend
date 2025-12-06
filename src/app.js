import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import rfpRouter from './routes/rfpRoutes.js';
import vendorRouter from './routes/vendorRoutes.js';
import proposalRouter from './routes/proposals.js';
import emailRouter from './routes/inbound.js';
import rfpRouterv2 from './routes/rfpRoutesV2.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

//  check
app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'ProcurAI backend is healthy' });
});

// API Routes
app.use('/api/email', emailRouter);
app.use('/api/vendors', vendorRouter);
app.use('/api/proposals', proposalRouter);
app.use('/api/rfps', rfpRouter);
app.use('/api/v2/rfps', rfpRouterv2);

// 404 handler
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

export default app;