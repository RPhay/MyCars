import path from 'path';
import config from '../../config/environment.js';
import { listDealerships } from '../researchStore.js';
import { fetchHtml } from './fetchPage.js';

const DEALERSHIPS_DIR = path.join(config.projectRoot, 'dealerships');

export async function findAllWorkflow(ctx, input) {
  const { make, model } = input;

  ctx.phase('Initializing search', `Looking for ${make} ${model}`);

  // Get list of all known dealerships
  ctx.phase('Loading dealership inventory', 'Reading local dealership data');
  const dealerships = await listDealerships();

  let found = 0;
  const results = [];

  for (const dealership of dealerships) {
    if (ctx.cancelled()) throw new Error('Search cancelled');

    ctx.phase(`Searching dealership ${found + 1}/${dealerships.length}`, dealership.name);

    // Check if dealership has this make/model in their research data
    if (dealership.research && dealership.research.inventory) {
      const inventory = dealership.research.inventory;
      const matches = inventory.filter(
        (v) => v.make?.toLowerCase() === make.toLowerCase() &&
                v.model?.toLowerCase() === model.toLowerCase()
      );

      if (matches.length > 0) {
        found += matches.length;
        results.push({
          dealership: dealership.name,
          url: dealership.url,
          count: matches.length,
          vehicles: matches,
        });
      }
    }
  }

  ctx.phase('Search complete', `Found ${found} matching vehicles`);

  // Return results in a structured format
  return {
    path: 'search results',
    summary: `Found ${found} ${make} ${model} vehicles across ${results.length} dealerships`,
    results,
  };
}
