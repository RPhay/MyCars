import fs from 'fs/promises';
import path from 'path';
import config from '../config/environment.js';

const VEHICLES_DIR = path.join(config.projectRoot, 'vehicles');
const DEALERSHIPS_DIR = path.join(config.projectRoot, 'dealerships');

/**
 * Vehicle Comparison Service
 * Compares all vehicles within a scope (make/year, make/model/year, make/model/year/trim)
 * Ranks by 8 equally-weighted factors, highlights special categories, flags red flags
 */

// Red flag penalties
const RED_FLAGS = {
  MISSING_PHOTOS: { penalty: 25, severity: 'warning', message: 'Missing photos - limited condition visibility' },
  HIGH_MILEAGE: { penalty: 25, severity: 'warning', message: 'High mileage (120k+) - increased maintenance risk' },
  NO_WARRANTY_OLD: { penalty: 20, severity: 'warning', message: 'No warranty on older vehicle - self-insured repairs' },
  DELIVERY_ONLY: { penalty: 0, severity: 'info', message: 'Delivery-only - you specified local pickup' },
  MULTIPLE_ISSUES: { penalty: 15, severity: 'warning', message: 'Multiple known issues - research before purchase' },
  ACCIDENT_HISTORY: { penalty: 30, severity: 'danger', message: 'Reported accident history - inspect thoroughly' },
  EXTREMELY_HIGH_MILEAGE: { penalty: 40, severity: 'danger', message: 'Extremely high mileage (150k+) - major repairs likely soon' },
};

/**
 * Parse vehicle analysis.md file to extract structured data
 */
async function parseVehicleAnalysis(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract structured data from analysis.md
    const data = {
      price: extractPrice(content),
      mileage: extractMileage(content),
      warranty: extractWarranty(content),
      dealerRating: extractDealerRating(content),
      knownIssues: extractKnownIssues(content),
      photosCount: 0, // Will be counted separately
      seller: extractSeller(content),
      trim: extractTrim(content),
      vin: extractVIN(content),
      accidentHistory: extractAccidentHistory(content),
    };

    return data;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

function extractPrice(content) {
  const match = content.match(/Asking Price[:\s]+\$?[\s]*[\$]?([\d,]+)/i);
  if (match) return parseInt(match[1].replace(/,/g, ''));

  const match2 = content.match(/Price[:\s]+\$?[\s]*[\$]?([\d,]+)/i);
  return match2 ? parseInt(match2[1].replace(/,/g, '')) : 0;
}

function extractMileage(content) {
  const match = content.match(/Mileage[:\s]+[\d,]+ mi/i);
  if (match) {
    const numMatch = match[0].match(/[\d,]+/);
    return numMatch ? parseInt(numMatch[0].replace(/,/g, '')) : 0;
  }
  return 0;
}

function extractWarranty(content) {
  if (content.includes('No warrant') || content.includes('expired')) return 'None';
  if (content.match(/\d+\s*years?\s*remaining/i)) {
    const match = content.match(/(\d+)\s*years?\s*remaining/i);
    const years = parseInt(match[1]);
    if (years >= 3) return '3+ years';
    if (years >= 2) return '2-3 years';
    if (years >= 1) return '1-2 years';
    return '<1 year';
  }
  if (content.match(/manufacturer.*warranty/i)) return 'Full manufacturer';
  if (content.match(/carmax.*warranty/i)) return '3+ years';
  return 'Unknown';
}

function extractDealerRating(content) {
  const match = content.match(/Rating[:\s]+(\d+(?:\.\d+)?)\s*\/\s*5/i);
  return match ? parseFloat(match[1]) : 3.5;
}

function extractKnownIssues(content) {
  const issues = [];
  if (content.match(/coolant loss/i)) issues.push('Coolant loss');
  if (content.match(/roof mechanism/i)) issues.push('Roof mechanism');
  if (content.match(/turbo wastegate/i)) issues.push('Turbo issues');
  if (content.match(/water pump/i)) issues.push('Water pump');
  if (content.match(/transmission/i) && content.match(/issue|problem/i)) issues.push('Transmission');
  if (content.match(/electrical|iDrive/i) && content.match(/issue|problem|glitch/i)) issues.push('Electronics');
  if (content.match(/brake|suspension/i) && content.match(/wear|issue/i)) issues.push('Suspension/Brakes');
  return issues;
}

function extractSeller(content) {
  const match = content.match(/Seller[:\s]+(.+?)(?:\n|,|$)/i);
  return match ? match[1].trim() : 'Unknown';
}

function extractTrim(content) {
  const match = content.match(/Trim[:\s]+(.+?)(?:\n|$)/i);
  if (match) return match[1].trim();

  if (content.includes('M40i')) return 'M40i';
  if (content.includes('sDrive30i')) return 'sDrive30i';
  if (content.includes('sDrive28i')) return 'sDrive28i';
  if (content.includes('sDrive35i')) return 'sDrive35i';
  return 'Unknown';
}

function extractVIN(content) {
  const match = content.match(/VIN[:\s]+([A-Z0-9]{17})/i);
  return match ? match[1] : 'Unknown';
}

function extractAccidentHistory(content) {
  return content.match(/accident|collision|damage history/i) ? true : false;
}

/**
 * Normalize score to 0-100 scale
 */
function normalizeScore(value, min, max, inverse = false) {
  if (max === min) return 50;
  const normalized = (value - min) / (max - min) * 100;
  return inverse ? 100 - normalized : Math.max(0, Math.min(100, normalized));
}

/**
 * Calculate all 8 factor scores for a vehicle
 */
function calculateFactorScores(vehicle, allVehicles, isLocalPreference = false) {
  const prices = allVehicles.map(v => v.price).filter(p => p > 0);
  const mileages = allVehicles.map(v => v.mileage);
  const dealerRatings = allVehicles.map(v => v.dealerRating);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const maxMileage = Math.max(...mileages);
  const minYear = Math.min(...allVehicles.map(v => v.modelYear || 2020));
  const maxYear = Math.max(...allVehicles.map(v => v.modelYear || 2023));

  const scores = {};

  // 1. Price Score (lower = better)
  scores.price = normalizeScore(vehicle.price, minPrice, maxPrice, true);

  // 2. Mileage Score (lower = better)
  scores.mileage = normalizeScore(vehicle.mileage, 0, maxMileage, true);

  // 3. Warranty Score
  const warrantyMap = { 'None': 0, '<1 year': 25, '1-2 years': 50, '2-3 years': 75, '3+ years': 100, 'Full manufacturer': 100, 'Unknown': 40 };
  scores.warranty = warrantyMap[vehicle.warranty] || 40;

  // 4. Dealer Rating Score
  scores.dealer = (vehicle.dealerRating / 5.0) * 100;

  // 5. Condition Score (photos + known issues)
  const photoBonus = Math.min((vehicle.photosCount || 0) / 8, 1.0) * 50;
  const issuesPenalty = (vehicle.knownIssues?.length || 0) * 10;
  scores.condition = Math.max(0, 50 + photoBonus - issuesPenalty);

  // 6. Age Score (newer = better)
  const modelYear = vehicle.modelYear || 2020;
  scores.age = normalizeScore(modelYear, minYear, maxYear, false);

  // 7. Local Availability Score
  scores.local = vehicle.isLocal ? 100 : 50;

  // 8. Value Score (price per 1000 miles)
  const pricePerMile = vehicle.mileage > 0 ? vehicle.price / (vehicle.mileage / 1000) : vehicle.price;
  const avgPricePerMile = allVehicles.reduce((sum, v) => sum + (v.mileage > 0 ? v.price / (v.mileage / 1000) : v.price), 0) / allVehicles.length;
  scores.value = Math.min((avgPricePerMile / pricePerMile) * 100, 100);

  // Calculate overall (equal weighting)
  scores.overall = (scores.price + scores.mileage + scores.warranty + scores.dealer + scores.condition + scores.age + scores.local + scores.value) / 8;

  return scores;
}

/**
 * Apply red flag penalties
 */
function applyRedFlagPenalties(vehicle, scores) {
  const flags = [];
  let adjustedScore = scores.overall;

  // Check red flags
  if (!vehicle.photosCount || vehicle.photosCount < 4) {
    flags.push(RED_FLAGS.MISSING_PHOTOS);
    adjustedScore -= RED_FLAGS.MISSING_PHOTOS.penalty;
  }

  if (vehicle.mileage > 150000) {
    flags.push(RED_FLAGS.EXTREMELY_HIGH_MILEAGE);
    adjustedScore -= RED_FLAGS.EXTREMELY_HIGH_MILEAGE.penalty;
  } else if (vehicle.mileage > 120000) {
    flags.push(RED_FLAGS.HIGH_MILEAGE);
    adjustedScore -= RED_FLAGS.HIGH_MILEAGE.penalty;
  }

  if (vehicle.warranty === 'None' && (2026 - (vehicle.modelYear || 2020)) > 7) {
    flags.push(RED_FLAGS.NO_WARRANTY_OLD);
    adjustedScore -= RED_FLAGS.NO_WARRANTY_OLD.penalty;
  }

  if (!vehicle.isLocal) {
    flags.push(RED_FLAGS.DELIVERY_ONLY);
  }

  if ((vehicle.knownIssues?.length || 0) >= 3) {
    flags.push(RED_FLAGS.MULTIPLE_ISSUES);
    adjustedScore -= RED_FLAGS.MULTIPLE_ISSUES.penalty;
  }

  if (vehicle.accidentHistory) {
    flags.push(RED_FLAGS.ACCIDENT_HISTORY);
    adjustedScore -= RED_FLAGS.ACCIDENT_HISTORY.penalty;
  }

  return {
    redFlags: flags,
    adjustedScore: Math.max(0, adjustedScore)
  };
}

/**
 * Generate recommended action based on scores and flags
 */
function getRecommendedAction(vehicle, scores, redFlags) {
  if (redFlags.adjustedScore < 30) {
    return { action: '❌ Skip', reason: 'Low overall score with significant red flags' };
  }

  if (redFlags.redFlags.length > 0) {
    return { action: '⚠️ Proceed with caution', reason: 'Review red flags before contacting dealer' };
  }

  if (scores.overall >= 80) {
    return { action: '✅ Strong contender', reason: 'High score across factors - contact dealer' };
  }

  if (scores.overall >= 60) {
    return { action: '✅ Contact dealer', reason: 'Solid option - worth inspecting' };
  }

  return { action: '💬 Negotiate', reason: 'Check for negotiation opportunity' };
}

/**
 * Identify special categories
 */
function identifySpecialCategories(vehicles, scores) {
  const categories = {};

  // Best Overall Value
  const bestOverall = vehicles.reduce((prev, current, i) => {
    return scores[i].overall > scores[prev].overall ? i : prev;
  }, 0);
  categories.bestOverall = bestOverall;

  // Best Budget
  const cheapest = vehicles.reduce((prev, current, i) => {
    return vehicles[i].price < vehicles[prev].price ? i : prev;
  }, 0);
  if (scores[cheapest].overall > 50) categories.bestBudget = cheapest;

  // Best Warranty
  const bestWarranty = vehicles.reduce((prev, current, i) => {
    return scores[i].warranty > scores[prev].warranty ? i : prev;
  }, 0);
  if (scores[bestWarranty].warranty > 0) categories.bestWarranty = bestWarranty;

  // Best Condition
  const bestCondition = vehicles.reduce((prev, current, i) => {
    return scores[i].condition > scores[prev].condition ? i : prev;
  }, 0);
  categories.bestCondition = bestCondition;

  // Best Local Option
  const localVehicles = vehicles.map((v, i) => v.isLocal ? i : -1).filter(i => i !== -1);
  if (localVehicles.length > 0) {
    categories.bestLocal = localVehicles.reduce((prev, i) => {
      return scores[i].overall > scores[prev].overall ? i : prev;
    }, localVehicles[0]);
  }

  return categories;
}

/**
 * Rank and sort vehicles
 */
function rankVehicles(vehicles, scores, allRedFlags) {
  const ranked = vehicles.map((v, i) => ({
    index: i,
    vehicle: v,
    scores: scores[i],
    redFlags: allRedFlags[i],
    adjustedScore: allRedFlags[i].adjustedScore,
  }));

  // Sort by adjusted score (desc), then by price (asc) as tiebreaker, then by local (desc)
  ranked.sort((a, b) => {
    if (Math.abs(a.adjustedScore - b.adjustedScore) > 0.1) {
      return b.adjustedScore - a.adjustedScore;
    }
    if (a.vehicle.price !== b.vehicle.price) {
      return a.vehicle.price - b.vehicle.price;
    }
    return (b.vehicle.isLocal ? 1 : 0) - (a.vehicle.isLocal ? 1 : 0);
  });

  return ranked;
}

/**
 * Main comparison function - called by route handler
 */
export async function compareVehicles(scopePath, isLocal = true) {
  try {
    // scopePath format: "make", "make/model", or "make/model/year"
    const parts = scopePath.split('/').filter(p => p.length > 0);
    const make = parts[0];
    const model = parts[1];
    const year = parts[2];

    // Find all vehicles matching scope
    const vehicles = [];

    // Build the base vehicle directory
    let baseDir = path.join(VEHICLES_DIR, make);
    if (model) baseDir = path.join(baseDir, model);
    if (year) baseDir = path.join(baseDir, year);

    if (!(await dirExists(baseDir))) {
      return { error: `No vehicles found for scope: ${scopePath}` };
    }

    // Recursively collect vehicles
    async function collectVehicles(dir, currentYear = null, hasModel = !!model) {
      if (!(await dirExists(dir))) return;

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // If we haven't set a model yet, and this doesn't look like a year (not 4 digits), recurse into it
        if (!model && !hasModel && !/^\d{4}$/.test(entry.name)) {
          await collectVehicles(path.join(dir, entry.name), currentYear, true);
          continue;
        }

        // If we haven't set a year yet, and this looks like a year directory (4 digits), recurse into it
        if (!year && !currentYear && /^\d{4}$/.test(entry.name)) {
          await collectVehicles(path.join(dir, entry.name), parseInt(entry.name), hasModel);
          continue;
        }

        // This should be a VIN directory at the deepest level
        const analysisPath = path.join(dir, entry.name, 'analysis.md');
        const photosPath = path.join(dir, entry.name, 'photos');

        if (!(await fileExists(analysisPath))) continue;

        const vehicleData = await parseVehicleAnalysis(analysisPath);
        if (!vehicleData) continue;

        // Count photos
        vehicleData.photosCount = await countPhotos(photosPath);
        vehicleData.modelYear = year ? parseInt(year) : (currentYear || 2020);
        vehicleData.isLocal = isLocal; // Set based on user preference
        vehicleData.vin = entry.name; // Use directory name as VIN

        vehicles.push(vehicleData);
      }
    }

    await collectVehicles(baseDir);

    if (vehicles.length === 0) {
      return { error: 'No vehicles found with analysis data' };
    }

    // Calculate scores for all vehicles
    const allScores = vehicles.map(v => calculateFactorScores(v, vehicles, isLocal));

    // Apply red flag penalties
    const allRedFlags = vehicles.map((v, i) => applyRedFlagPenalties(v, allScores[i]));

    // Get recommended actions
    const recommendations = vehicles.map((v, i) => getRecommendedAction(v, allScores[i], allRedFlags[i]));

    // Rank vehicles
    const ranked = rankVehicles(vehicles, allScores, allRedFlags);

    // Identify special categories
    const categories = identifySpecialCategories(vehicles, allScores);

    return {
      scopePath,
      vehicleCount: vehicles.length,
      ranked: ranked.map((r, rank) => ({
        rank: rank + 1,
        vin: r.vehicle.vin,
        price: r.vehicle.price,
        mileage: r.vehicle.mileage,
        trim: r.vehicle.trim,
        seller: r.vehicle.seller,
        isLocal: r.vehicle.isLocal,
        warranty: r.vehicle.warranty,
        dealerRating: r.vehicle.dealerRating,
        photosCount: r.vehicle.photosCount,
        knownIssues: r.vehicle.knownIssues || [],
        scores: r.scores,
        adjustedScore: r.adjustedScore,
        redFlags: r.redFlags.redFlags,
        recommendation: recommendations[r.index],
        isSpecial: {
          bestOverall: r.index === categories.bestOverall,
          bestBudget: r.index === categories.bestBudget,
          bestWarranty: r.index === categories.bestWarranty,
          bestCondition: r.index === categories.bestCondition,
          bestLocal: r.index === categories.bestLocal,
        }
      })),
      summary: {
        priceRange: { min: Math.min(...vehicles.map(v => v.price)), max: Math.max(...vehicles.map(v => v.price)) },
        mileageRange: { min: Math.min(...vehicles.map(v => v.mileage)), max: Math.max(...vehicles.map(v => v.mileage)) },
        localCount: vehicles.filter(v => v.isLocal).length,
        deliveryCount: vehicles.filter(v => !v.isLocal).length,
        withWarranty: vehicles.filter(v => v.warranty !== 'None').length,
        withoutWarranty: vehicles.filter(v => v.warranty === 'None').length,
      }
    };
  } catch (error) {
    console.error('Comparison error:', error);
    return { error: `Comparison failed: ${error.message}` };
  }
}

// Helper functions
async function dirExists(dir) {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function countPhotos(photosDir) {
  try {
    if (!(await dirExists(photosDir))) return 0;
    const files = await fs.readdir(photosDir);
    return files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)).length;
  } catch {
    return 0;
  }
}

export default {
  compareVehicles,
};
