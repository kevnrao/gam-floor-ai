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
     * Ensures the bid is only 1 cent higher than required to win.
     * 
     * @param {string} adUnitCode - The ad unit being bid on.
     */
    function adjustPricingRule(adUnitCode) {
        if (!bidHistory[adUnitCode] || bidHistory[adUnitCode].length < 5) {
            console.log(`Not enough data to adjust pricing for ${adUnitCode}`);
            return;
        }

        // Sort historical bids to determine the lowest winning bid
        let sortedBids = [...bidHistory[adUnitCode]].sort((a, b) => a - b);
        let requiredBid = sortedBids[Math.floor(sortedBids.length * 0.9)] || sortedBids[0]; // 90th percentile as clearing price

        // Adjust bid: 1 cent higher than the required bid
        let optimalBid = requiredBid + priceAdjustmentFactor;

        // Calculate savings
        let lastBid = sortedBids[sortedBids.length - 1];
        let savings = lastBid - optimalBid;
        let platformRevenue = savings * revenueShare;
        let returnedToMedia = savings * (1 - revenueShare);

        console.log(`Updating bid strategy for ${adUnitCode}:`);
        console.log(` - Required bid: $${requiredBid}`);
        console.log(` - New optimal bid: $${optimalBid}`);
        console.log(` - Platform revenue: $${platformRevenue}`);
        console.log(` - Media reinvestment: $${returnedToMedia}`);

        // Send updated pricing rule to Google Ad Manager
        updateGoogleAdManagerPricing(adUnitCode, optimalBid);
    }

    /**
     * Sends a request to update Google Ad Manager Unified Pricing Rules.
     * 
     * @param {string} adUnitCode - The ad unit to update pricing for.
     * @param {number} newBidPrice - The new optimal bid price.
     */
    function updateGoogleAdManagerPricing(adUnitCode, newBidPrice) {
        fetch('https://www.googleapis.com/admanager/v202302/UnifiedPricingRules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_ACCESS_TOKEN` // Replace with valid OAuth token
            },
            body: JSON.stringify({
                adUnit: adUnitCode,
                newPrice: newBidPrice
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log(`Updated Unified Pricing Rule for ${adUnitCode}:`, data);
        })
        .catch(error => {
            console.error(`Error updating pricing rule for ${adUnitCode}:`, error);
        });
    }

    console.log("Prebid.js bid monitoring script active. Written by Kevin Rao.");
})();
