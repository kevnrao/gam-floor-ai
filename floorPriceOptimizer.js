// floorPriceOptimizer.js

/**
 * @param {number} bid - The bid price (e.g., Prebid hb_pb value).
 * @param {number[]} buckets - Array of bucket thresholds in ascending order.
 * @returns {number} - The matched floor price.
 */
export function getFloorBucket(bid, buckets = [0.1, 0.5, 1, 2, 5, 10]) {
  if (isNaN(bid)) return 0.1;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (bid >= buckets[i]) return buckets[i];
  }
  return buckets[0];
}

/**
 * @param {number} floor
 * @returns {string} - e.g., '1.50'
 */
export function roundGAMFloor(floor) {
  return (Math.floor(floor * 100) / 100).toFixed(2);
}

/**
 * @param {number} bid - Raw bid input (e.g., window._m_.pb).
 * @param {Object} options - Optional parameters.
 * @param {number[]} options.buckets - Price buckets.
 * @param {boolean} options.usePrefix - Whether to use a prefix like 'floor_'.
 * @returns {string} - e.g., 'floor_2.00'
 */
export function generateFloorKey(bid, options = {}) {
  const { buckets = [0.1, 0.5, 1, 2, 5, 10], usePrefix = true } = options;
  const bucket = getFloorBucket(parseFloat(bid), buckets);
  const floor = roundGAMFloor(bucket);
  return usePrefix ? `floor_${floor}` : floor;
}

import { generateFloorKey } from './floorPriceOptimizer.js';

googletag.cmd.push(function () {
  const slot = googletag.defineSlot('/1234/test', [970, 250], 'div-gpt-ad');
  const bidPrice = window._m_?.pb || 1.00; // fallback if missing

  const floorKey = generateFloorKey(bidPrice, {
    buckets: [0.1, 0.5, 1, 1.5, 2, 5],
    usePrefix: true,
  });

  slot.setTargeting('floorprice', floorKey);  // e.g., 'floor_1.50'
  slot.addService(googletag.pubads());
});
