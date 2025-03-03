/**
 * Prebid.js Bid Monitoring & Google Ad Manager Unified Pricing Rule Adjuster 
 * 
 * Written by: Kevin Rao
 * 
 * Description:
 * - Monitors bid responses from Prebid.js in real-time.
 * - Analyzes historical bid data to determine optimal pricing.
 * - Adjusts bids 1 cent higher than needed to win while accounting for platform revenue.
 * - Increases floor pricing by 15-20% during peak hours (7:30AM - 9:30AM, 4:30PM - 7:00PM).
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
    const peakHourIncrease = 0.15; // 15% increase in floor price during peak hours

    /**
     * Checks if the current time falls within peak hours.
     * Peak hours: 7:30AM - 9:30AM & 4:30PM - 7:00PM
     * @returns {boolean} - Returns true if it's peak hours.
     */
    function isPeakHour() {
        let now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        let timeInMinutes = hours * 60 + minutes;

        // Define peak hour ranges in minutes (e.g., 450 = 7:30 AM, 570 = 9:30 AM)
        let morningPeakStart = 450; // 7:30 AM
        let morningPeakEnd = 570;   // 9:30 AM
        let eveningPeakStart = 990; // 4:30 PM
        let eveningPeakEnd = 1140;  // 7:00 PM

        return (timeInMinutes >= morningPeakStart && timeInMinutes <= morningPeakEnd) ||
               (timeInMinutes >= eveningPeakStart && timeInMinutes <= eveningPeakEnd);
    }

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
     * Adjusts the pricing rule based on bid history and peak hour adjustments.
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

        // Apply peak hour multiplier
        if (isPeakHour()) {
            let peakMultiplier = 1 + peakHourIncrease + (Math.random() * 0.05); // 15-20% increase
            optimalBid *= peakMultiplier;
            console.log(`🔺 Peak hour detected! Increasing floor price by ${((peakMultiplier - 1) * 100).toFixed(2)}%`);
        }

        // Calculate savings
        let lastBid = sortedBids[sortedBids.length - 1];
        let savings = lastBid - optimalBid;
        let platformRevenue = savings * revenueShare;
        let returnedToMedia = savings * (1 - revenueShare);

        console.log(`Updating bid strategy for ${adUnitCode}:`);
        console.log(` - Required bid: $${requiredBid.toFixed(2)}`);
        console.log(` - New optimal bid: $${optimalBid.toFixed(2)}`);
        console.log(` - Platform revenue: $${platformRevenue.toFixed(2)}`);
        console.log(` - Media reinvestment: $${returnedToMedia.toFixed(2)}`);

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
            console.log(`✅ Updated Unified Pricing Rule for ${adUnitCode}:`, data);
        })
        .catch(error => {
            console.error(`❌ Error updating pricing rule for ${adUnitCode}:`, error);
        });
    }

    console.log("🚀 pbjs bid monitoring script with peak hour adjustments active.");
})();
