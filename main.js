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
        console.warn("pbjs not found!");
        return;
    }

    let bidHistory = {};
    const bidExpirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    const config = {
        priceAdjustmentFactor: 0.01, // Default $0.01 increase
        peakHourMultiplierBase: 0.15, // Default 15% increase
        peakHourCap: 0.25, // Increased max cap to 25%
        peakHours: [
            { start: 450, end: 570 },  // Morning: 7:30 AM – 9:30 AM (in minutes)
            { start: 990, end: 1140 }  // Evening: 4:30 PM – 7:00 PM (in minutes)
        ],
        debugMode: false // Toggle debugging logs
    };

    function isPeakHour() {
        let now = new Date();
        let timeInMinutes = now.getHours() * 60 + now.getMinutes();
        return config.peakHours.some(({ start, end }) => timeInMinutes >= start && timeInMinutes <= end);
    }

    pbjs.onEvent('bidResponse', function (bid) {
        const { adUnitCode, cpm, bidder } = bid;
        
        if (!bidHistory[adUnitCode]) {
            bidHistory[adUnitCode] = [];
        }

        bidHistory[adUnitCode].push({ cpm, timestamp: Date.now() });

        // Remove expired bids
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
        let optimalBid = requiredBid + config.priceAdjustmentFactor;

        if (isPeakHour()) {
            let peakMultiplier = 1 + getPeakHourMultiplier(adUnitCode);
            optimalBid *= peakMultiplier;
            debugLog(`🔺 Peak hour! Increasing floor price by ${(peakMultiplier * 100).toFixed(2)}%`);
        }

        debugLog(`Updating bid strategy for ${adUnitCode}:`);
        debugLog(` - Required bid: $${requiredBid.toFixed(2)}`);
        debugLog(` - New optimal bid: $${optimalBid.toFixed(2)}`);

        let roundedBid = roundBid(optimalBid);
        pbjs.setTargeting(adUnitCode, { "hb_pb": roundedBid });

        updateGoogleAdManagerPricing(adUnitCode, optimalBid);
    }

    function getPeakHourMultiplier(adUnitCode) {
        if (!bidHistory[adUnitCode] || bidHistory[adUnitCode].length < 5) {
            return config.peakHourMultiplierBase; // Default if no data
        }

        let bidValues = bidHistory[adUnitCode]
            .filter(entry => (Date.now() - entry.timestamp) < bidExpirationTime)
            .map(entry => entry.cpm);

        let averageBid = bidValues.reduce((sum, bid) => sum + bid, 0) / bidValues.length;
        let bidStandardDeviation = Math.sqrt(
            bidValues.reduce((sum, bid) => sum + Math.pow(bid - averageBid, 2), 0) / bidValues.length
        );
        
        let calculatedMultiplier = config.peakHourMultiplierBase + (bidStandardDeviation * 0.02);
        return Math.min(calculatedMultiplier, config.peakHourCap);
    }

    function roundBid(optimalBid) {
        if (optimalBid < 5) {
            return (Math.round(optimalBid * 100) / 100).toFixed(2); // $0.01 increment
        } else if (optimalBid < 10) {
            return (Math.round(optimalBid * 20) / 20).toFixed(2); // $0.05 increment
        } else {
            return (Math.round(optimalBid * 10) / 10).toFixed(1); // $0.1 increment
        }
    }

    function updateGoogleAdManagerPricing(adUnitCode, newBidPrice) {
        console.warn("🚨 Google Ad Manager API integration required!");
        debugLog(`Would update ${adUnitCode} price to: $${newBidPrice}`);
        // Implement OAuth2 token refresh and call Google Ad Manager API from a secure backend.
    }

    function debugLog(message) {
        if (config.debugMode) console.log(message);
    }

    console.log("pbjs bid optimization script with configurable settings active.");
})();


