// gw2-proxy Cloudflare Worker
// Proxies requests to GW2 API endpoints.
// API key is accepted in the POST body only — never in the URL.

const ALLOWED_ORIGINS = [
    "https://craftmander.strikingwolf26.workers.dev",
    "https://pactcraftmander.netlify.app",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
];

// Whitelist of GW2 API endpoints this proxy will forward to
const ALLOWED_ENDPOINTS = {
    "materials": "https://api.guildwars2.com/v2/account/materials",
    "account":   "https://api.guildwars2.com/v2/account",
};

const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin":  ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
});

export default {
    async fetch(request) {
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
                status: 405,
                headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
        }

        const apiKey   = body?.api_key?.trim();
        const endpoint = body?.endpoint || "materials";

        if (!apiKey) {
            return new Response(JSON.stringify({ error: "No API key provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
        }

        const gw2Url = ALLOWED_ENDPOINTS[endpoint];
        if (!gw2Url) {
            return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
        }

        const gw2Res  = await fetch(`${gw2Url}?access_token=${encodeURIComponent(apiKey)}`);
        const gw2Body = await gw2Res.text();

        return new Response(gw2Body, {
            status: gw2Res.status,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
    },
};
