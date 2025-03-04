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
            { start: 450, end: 570 },  // Morning: 7:30 AM – 9:30 AM in minutes 
            { start: 990, end: 1140 }  // Evening: 4:30 PM – 7:00 PM in minutes
        ],
        debugMode: false // Toggle debugging logs
    };

    function isPeakHour() {
        let now = new Date();
        let timeInMinutes = now.getHours() * 60 + now.getMinutes();
        return config.peakHours.some(({ start, end }) => timeInMinutes >= start && timeInMinutes <= end);
    }

    function isPrebidBidding(adUnitCode) {
        const targeting = pbjs.getTargetingForAdUnitCode(adUnitCode);
        return targeting && targeting["hb_pb"];
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
        } else {
            debugLog(`Prebid.js is not bidding on ${adUnitCode}, skipping adjustments.`);
        }
    });

    async function updateGoogleAdManagerPricing(adUnitCode, newBidPrice) {
        console.warn("GAM API integration required!");
        debugLog(`Would update ${adUnitCode} price to: $${newBidPrice}`);
        
        const accessToken = await getOAuthToken();
        const UPR_API_URL = `https://www.googleapis.com/dfp/v202311/PricingRuleService/updatePricingRules`;

        const pricingRuleData = {
            adUnitCode: adUnitCode,
            newPrice: newBidPrice
        };

        try {
            const response = await fetch(UPR_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(pricingRuleData)
            });

            if (response.ok) {
                debugLog(`UPR updated for ${adUnitCode}: $${newBidPrice}`);
            } else {
                console.error("Failed to update UPR", await response.text());
            }
        } catch (error) {
            console.error("Error updating UPR:", error);
        }
    }

    async function getOAuthToken() {
        const CLIENT_ID = "YOUR_CLIENT_ID";
        const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
        const REFRESH_TOKEN = "YOUR_REFRESH_TOKEN";
        
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
                return data.access_token;
            } else {
                throw new Error("Failed to retrieve access token");
            }
        } catch (error) {
            console.error("Error retrieving OAuth token:", error);
            return null;
        }
    }

    console.log("pbjs bid optimization script with OAuth-based UPR updates active.");
})();



