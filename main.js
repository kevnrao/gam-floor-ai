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
    let pageRefreshCount = parseInt(localStorage.getItem("pageRefreshCount") || "0", 10);
    pageRefreshCount += 1;
    localStorage.setItem("pageRefreshCount", pageRefreshCount);

    const config = {
        priceAdjustmentFactor: 0.01, // Default $0.01 increase
        peakHourMultiplierBase: 0.15, // Default 15% increase
        peakHourCap: 0.25, // Increased max cap to 25%
        peakHours: [
            { start: 450, end: 570 },  // Morning: 7:30 AM – 9:30 AM in minutes
            { start: 990, end: 1140 }  // Evening: 4:30 PM – 7:00 PM in minutes
        ],
        debugMode: false // Toggle debugging logs
    };

    function debugLog(message) {
        if (config.debugMode) {
            console.log(message);
        }
    }

    function isPeakHour() {
        let now = new Date();
        let timeInMinutes = now.getHours() * 60 + now.getMinutes();
        return config.peakHours.some(({ start, end }) => timeInMinutes >= start && timeInMinutes <= end);
    }

    function isPrebidBidding(adUnitCode) {
        const bidResponses = pbjs.getBidResponsesForAdUnitCode(adUnitCode);
        return bidResponses && bidResponses.bids && bidResponses.bids.length > 0;
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

        if (isPrebidBidding(adUnitCode)) {
            adjustPricingRule(adUnitCode);
            setRefreshTargeting(adUnitCode);
        } else {
            debugLog(`pbjs not bidding on ${adUnitCode}, skipping adjustments.`);
        }
    });

    function setRefreshTargeting(adUnitCode) {
        let refreshCategory = "first_page_view";
        if (pageRefreshCount === 2) {
            refreshCategory = "second_page_view";
        } else if (pageRefreshCount >= 3) {
            refreshCategory = "third_or_more_page_view";
        }
        pbjs.setTargeting(adUnitCode, { "page_refresh": refreshCategory });
        debugLog(`Set page refresh targeting for ${adUnitCode}: ${refreshCategory}`);
    }

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
            let peakMultiplier = 1 + config.peakHourMultiplierBase;
            optimalBid *= peakMultiplier;
            debugLog(`Peak hour! Increasing floor price by ${(peakMultiplier * 100).toFixed(2)}%`);
        }

        debugLog(`Updating bid strategy for ${adUnitCode}: Optimal bid set to $${optimalBid.toFixed(2)}`);
        updateGoogleAdManagerPricing(adUnitCode, optimalBid);
    }

    let oauthTokenCache = {
        token: null,
        expiresAt: 0
    };

    async function getOAuthToken() {
        const CLIENT_ID = "YOUR_CLIENT_ID";
        const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
        const REFRESH_TOKEN = "YOUR_REFRESH_TOKEN";
        const TOKEN_EXPIRY_BUFFER = 30000; // Refresh 30 seconds before expiry

        if (oauthTokenCache.token && Date.now() < oauthTokenCache.expiresAt - TOKEN_EXPIRY_BUFFER) {
            return oauthTokenCache.token;
        }

        try {
            const response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    refresh_token: REFRESH_TOKEN,
                    grant_type: "refresh_token",
                }),
            });

            const data = await response.json();
            if (data.access_token) {
                oauthTokenCache.token = data.access_token;
                oauthTokenCache.expiresAt = Date.now() + (data.expires_in * 1000);
                return data.access_token;
            } else {
                throw new Error("Failed to retrieve access token");
            }
        } catch (error) {
            console.error("Error retrieving OAuth token:", error);
            return null;
        }
    }

    console.log("pbjs bid optimization script with OAuth-based UPR updates and cascading page refresh targeting active.");
})();
