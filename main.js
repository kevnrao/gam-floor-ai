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
        console.warn("prebid.js not found!");
        return;
    }

    let bidHistory = {};
    const priceAdjustmentFactor = 0.01; // Adjust bid 1 cent higher
    const revenueShare = 0.2; // Google takes 20% of savings
    const peakHourIncrease = 0.15;
    const debugMode = false; // Toggle this for debugging logs
    const bidExpirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    function isPeakHour() {
        let now = new Date();
        let timeInMinutes = now.getHours() * 60 + now.getMinutes();
        return (
            (timeInMinutes >= 450 && timeInMinutes <= 570) || // Morning: 7:30-9:30 AM
            (timeInMinutes >= 990 && timeInMinutes <= 1140)  // Evening: 4:30-7:00 PM
        );
    }

    pbjs.onEvent('bidResponse', function (bid) {
        const { adUnitCode, cpm, bidder } = bid;
        
        if (!bidHistory[adUnitCode]) {
            bidHistory[adUnitCode] = [];
        }

        // Store latest bid with timestamp
        bidHistory[adUnitCode].push({ cpm, timestamp: Date.now() });

        // Remove bids older than 24 hours
        bidHistory[adUnitCode] = bidHistory[adUnitCode].filter(bid => (Date.now() - bid.timestamp) < bidExpirationTime);

        debugLog(`Bid received from ${bidder} for ${adUnitCode}: $${cpm}`);
        adjustPricingRule(adUnitCode);
    });

    function adjustPricingRule(adUnitCode) {
        if (!bidHistory[adUnitCode] || bidHistory[adUnitCode].length < 5) {
            debugLog(`Not enough data to adjust pricing for ${adUnitCode}`);
            return;
        }

        let sortedBids = bidHistory[adUnitCode]
            .map(entry => entry.cpm)
            .sort((a, b) => a - b);

        let requiredBid = sortedBids[Math.floor(sortedBids.length * 0.9)] || sortedBids[0];

        let optimalBid = requiredBid + priceAdjustmentFactor;

        if (isPeakHour()) {
            let peakMultiplier = 1 + getPeakHourMultiplier(adUnitCode);
            optimalBid *= peakMultiplier;
            debugLog(`🔺 Peak hour! Increasing floor price by ${(peakMultiplier * 100).toFixed(2)}%`);
        }

        let lastBid = sortedBids[sortedBids.length - 1];
        let savings = lastBid - optimalBid;
        let platformRevenue = savings * revenueShare;
        let returnedToMedia = savings * (1 - revenueShare);

        debugLog(`Updating bid strategy for ${adUnitCode}:`);
        debugLog(` - Required bid: $${requiredBid.toFixed(2)}`);
        debugLog(` - New optimal bid: $${optimalBid.toFixed(2)}`);
        debugLog(` - Platform revenue: $${platformRevenue.toFixed(2)}`);
        debugLog(` - Media reinvestment: $${returnedToMedia.toFixed(2)}`);

        // Round bid to the nearest 0.1 increment for targeting
        let roundedBid = (Math.round(optimalBid * 10) / 10).toFixed(1);
        pbjs.setTargeting(adUnitCode, { "upr-bid": roundedBid });

        updateGoogleAdManagerPricing(adUnitCode, optimalBid);
    }

    function getPeakHourMultiplier(adUnitCode) {
        if (!bidHistory[adUnitCode] || bidHistory[adUnitCode].length < 5) {
            return peakHourIncrease; // Default multiplier if no data
        }

        let bidValues = bidHistory[adUnitCode]
            .filter(entry => (Date.now() - entry.timestamp) < bidExpirationTime)
            .map(entry => entry.cpm);

        let averageBid = bidValues.reduce((sum, bid) => sum + bid, 0) / bidValues.length;

        // Use a multiplier based on past 24-hour bidding trends
        let calculatedMultiplier = peakHourIncrease + (averageBid * 0.01);
        return Math.min(calculatedMultiplier, 0.2); // Cap at 20%
    }

    function updateGoogleAdManagerPricing(adUnitCode, newBidPrice) {
        console.warn(`🚨 Google Ad Manager API integration required!`);
        debugLog(`Would update ${adUnitCode} price to: $${newBidPrice}`);
        // Implement OAuth2 token refresh and call Google Ad Manager API from a secure backend.
    }

    function debugLog(message) {
        if (debugMode) console.log(message);
    }

    console.log("🚀 pbjs bid monitoring script with 24-hour bid history and peak hour adjustments active.");
})();
