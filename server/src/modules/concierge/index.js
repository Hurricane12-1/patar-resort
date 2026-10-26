/**
 * ============================================================================
 * Rock View Beach Resort · Pluggable Domain Module Example
 * Module: Guest Concierge & FAQ Service
 * Location: Brgy. Patar, Bolinao, Pangasinan (16.3042° N, 119.7821° E)
 * ============================================================================
 */

import { Router } from 'express';

const router = Router();

const RESORT_FAQS = [
  {
    category: 'Location & Directions',
    question: 'Where is Rock View Beach Resort located?',
    answer: 'We are located along the pristine shores of Brgy. Patar, Bolinao, Pangasinan (Coordinates: 16.3042° N, 119.7821° E), just 5 minutes from the historic Cape Bolinao Lighthouse and Patar White Beach.',
  },
  {
    category: 'Check-In Guidelines',
    question: 'What are the check-in and check-out times?',
    answer: 'Standard check-in is at 2:00 PM and check-out is at 12:00 PM noon. Early check-in can be requested based on room turnaround status.',
  },
  {
    category: 'Accommodations',
    question: 'Which unit is best for large groups?',
    answer: 'Unit TEV Grand Villa sleeps up to 60 guests with dedicated kitchen, grill, and karaoke. Unit GEL Premier Suite sleeps up to 25 guests, and Unit CAT Cottage (Unit Papang) sleeps up to 10 guests.',
  },
  {
    category: 'Amenities',
    question: 'Is cooking allowed on site?',
    answer: 'Yes! Kitchen facilities, cookware, refrigerators, and BBQ grilling stations are provided with our villas and cottages.',
  },
];

router.get('/faq', (_req, res) => {
  res.json({
    resort: 'Rock View Beach Resort',
    location: 'Brgy. Patar, Bolinao, Pangasinan',
    faqs: RESORT_FAQS,
  });
});

router.post('/inquire', (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required in request body.' });
  }

  const normalized = query.toLowerCase();
  let matchedFaq = RESORT_FAQS.find(f => 
    normalized.includes(f.question.toLowerCase()) || 
    f.answer.toLowerCase().includes(normalized)
  );

  if (!matchedFaq) {
    matchedFaq = {
      question: query,
      answer: 'Thank you for your inquiry regarding Rock View Beach Resort, Patar, Bolinao! Our reception team is available 24/7 for booking assistance and custom arrangements.',
    };
  }

  res.json({
    query,
    response: matchedFaq.answer,
    contact: {
      location: 'Brgy. Patar, Bolinao, Pangasinan',
      reception: '+63 900 000 0000',
    },
  });
});

router.get('/health', (_req, res) => {
  res.json({
    module: 'concierge',
    status: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
  });
});

export default {
  name: 'concierge',
  version: '1.0.0',
  description: 'Automated Guest Inquiries and Rock View Resort Concierge Service',
  mountPath: '/api/concierge',
  router,
  healthCheck: async () => ({ status: 'HEALTHY', activeFaqs: RESORT_FAQS.length }),
};
