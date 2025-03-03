/**
 * Prebid.js Bid Monitoring & Google Ad Manager Unified Pricing Rule Adjuster
 * 
 * Written by: Kevin Rao
 * 
 * Description:
 * - Monitors bid responses from Prebid.js in real time.
 * - Analyzes historical bid data to determine optimal pricing.
 * - Adjusts bids 1 cent higher than needed to win while accounting for platform revenue.
 * - Updates Google Ad Manager Unified Pricing Rules dynamically.
 */

(function () {
    if (!window.pbjs) {
        console.warn("Prebid.js not found!");
        return;
    }

    let bidHistory = {}; // Stores bid history per ad unit
    const priceAdjustmentFactor = 0.01; // Adjust bid 1 cent higher than needed
    const revenueShare = 0.2; // Google takes 20% of the savings

    /**
     * Listens for bid responses from Prebid.js and stores historical bid prices.
     * 
     * @param {Object} bid - The bid response object from Prebid.js.
     */
    pbjs.onEvent('bidResponse', function (bid) {
        const { adUnitCode, cpm, bidder } = bid;
        
        if (!bidHistory[adUnitCode]) {
            bidHistory[adUnitCode] = [];
        }

        // Store bid history for future price adjustments
        bidHistory[adUnitCode].push(cpm);

        console.log(`Bid received from ${bidder} for ${adUnitCode}: $${cpm}`);

        adjustPricingRule(adUnitCode);
    });

    /**
     * Adjusts the pricing rule based on bid history.
     * Ensures the bid is only
