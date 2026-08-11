import { Router } from 'express';
import {
  listDealerships,
  getDealership,
  deleteDealership,
  setDealershipMeta,
  addDealershipCorrespondence,
  deleteDealershipCorrespondence,
  createDealershipStub,
} from '../services/researchStore.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const dealerships = await listDealerships();

    // Group dealerships by state and city
    const grouped = {};
    dealerships.forEach((d) => {
      let address = d.fields['Address'] || '';
      let city = 'Unknown';
      let state = 'Unknown';

      if (address) {
        // Try to parse: "City, State" or "Address, City, State ZIP" format
        const parts = address.split(',').map((p) => p.trim());

        if (parts.length >= 2) {
          // Standard format: "City, State" or "City, State ZIP"
          const lastPart = parts[parts.length - 1]; // State or "State ZIP"
          const secondLastPart = parts[parts.length - 2]; // City

          const stateMatch = lastPart.match(/^([A-Z]{2})/);
          if (stateMatch) {
            state = stateMatch[1];
            city = secondLastPart;
          } else {
            // Fallback: assume last part is city, second-to-last is state
            city = lastPart;
            state = secondLastPart;
          }
        } else if (parts.length === 1) {
          // Single part - could be "City, State" with no comma or just city
          const match = address.match(/^(.+?),\s*([A-Z]{2})(?:\s*\d{5})?$/);
          if (match) {
            city = match[1].trim();
            state = match[2];
          }
        }
      }

      if (!grouped[state]) grouped[state] = {};
      if (!grouped[state][city]) grouped[state][city] = [];
      grouped[state][city].push(d);
    });

    // Sort states and cities
    const sortedGrouped = {};
    Object.keys(grouped)
      .sort()
      .forEach((state) => {
        sortedGrouped[state] = {};
        Object.keys(grouped[state])
          .sort()
          .forEach((city) => {
            sortedGrouped[state][city] = grouped[state][city];
          });
      });

    res.render('pages/dealership-list', {
      title: 'Dealerships',
      dealerships,
      grouped: sortedGrouped,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const domain = await createDealershipStub(req.body.name, req.body.url);
    res.json({ domain });
  } catch (err) {
    if (err.message.includes('required') || err.message.includes('already in the list')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/:domain', async (req, res, next) => {
  try {
    const dealership = await getDealership(req.params.domain);
    res.render('pages/dealership-detail', {
      title: dealership.title,
      domain: req.params.domain,
      dealership,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).render('pages/404', { title: 'Not Found' });
    }
    next(err);
  }
});

router.put('/:domain/meta', async (req, res, next) => {
  try {
    const meta = await setDealershipMeta(req.params.domain, req.body);
    res.json(meta);
  } catch (err) {
    if (err.message === 'Invalid rating' || err.message === 'Invalid status' || err.message === 'Invalid notes') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/:domain/correspondence', async (req, res, next) => {
  try {
    const entry = await addDealershipCorrespondence(req.params.domain, req.body);
    res.json(entry);
  } catch (err) {
    if (err.message.startsWith('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/:domain/correspondence/:entryId', async (req, res, next) => {
  try {
    await deleteDealershipCorrespondence(req.params.domain, req.params.entryId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:domain', async (req, res, next) => {
  try {
    await deleteDealership(req.params.domain);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
