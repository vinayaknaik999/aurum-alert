import webpush from 'web-push';

interface Env {
    ALERTS_STORAGE: KVNamespace;
    VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
    VAPID_SUBJECT: string;
}

interface UserSettings {
    subscription: any;
    targetPrice24K: number | null;
    targetPrice22K: number | null;
    notifyBlinkdeals: boolean;
    lastNotifiedAt?: number;
    lastNotifiedIds?: string[];
}

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function getHash(input: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResp(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}

// ── SCRAPER LOGIC ─────────────────────────────────────────────────────────────
async function fetchGoldRate() {
    try {
        const res = await fetch('https://www.bankbazaar.com/gold-rate-bangalore.html', {
            headers: { 'User-Agent': UA_DESKTOP }
        });
        const text = await res.text();
        const m24 = text.match(/24\s*Karat\s*Gold.*?₹\s*([\d,]+)/i);
        const m22 = text.match(/22\s*Karat\s*Gold.*?₹\s*([\d,]+)/i);

        let rate24 = m24 ? parseInt(m24[1].replace(/,/g, ''), 10) : 9200;
        let rate22 = m22 ? parseInt(m22[1].replace(/,/g, ''), 10) : 8433;

        // Normalization
        if (rate24 > 30000) rate24 = Math.round(rate24 / 10);
        if (rate22 > 30000) rate22 = Math.round(rate22 / 10);

        return { rate24KT: rate24, rate22KT: rate22, updatedAt: new Date().toISOString() };
    } catch {
        return { rate24KT: 9200, rate22KT: 8433, updatedAt: new Date().toISOString() };
    }
}

async function fetchMyntra() {
    const url = 'https://www.myntra.com/gold-coin';
    const res = await fetch(url, { headers: { 'User-Agent': UA_DESKTOP } });
    const html = await res.text();
    const searchStr = '"products":[';
    const startIdx = html.indexOf(searchStr);
    if (startIdx === -1) return [];

    const arrayStart = startIdx + '"products":'.length;
    let bracketCount = 0;
    let endIdx = -1;
    for (let i = arrayStart; i < html.length; i++) {
        if (html[i] === '[') bracketCount++;
        else if (html[i] === ']') {
            bracketCount--;
            if (bracketCount === 0) { endIdx = i + 1; break; }
        }
    }
    return endIdx === -1 ? [] : JSON.parse(html.substring(arrayStart, endIdx));
}

// ── NOTIFICATION ENGINE ───────────────────────────────────────────────────────
async function sendPush(sub: any, payload: any, env: Env) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        return true;
    } catch (e: any) {
        return e.statusCode === 410 || e.statusCode === 404 ? 'expired' : false;
    }
}

// ── WORKER HANDLER ────────────────────────────────────────────────────────────
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);
        if (request.method === 'OPTIONS') return jsonResp({});

        if (url.pathname === '/api/latest') {
            const [goldRate, products] = await Promise.all([fetchGoldRate(), fetchMyntra()]);
            return jsonResp({ goldRate, products });
        }

        if (url.pathname === '/api/subscribe' && request.method === 'POST') {
            const body: UserSettings = await request.json();
            const key = `user:${await getHash(body.subscription.endpoint)}`;
            await env.ALERTS_STORAGE.put(key, JSON.stringify(body));
            return jsonResp({ success: true });
        }

        return jsonResp({ error: 'Not found' }, 404);
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        const [goldRate, products] = await Promise.all([fetchGoldRate(), fetchMyntra()]);
        const { keys } = await env.ALERTS_STORAGE.list({ prefix: 'user:' });

        for (const key of keys) {
            const user: UserSettings = await env.ALERTS_STORAGE.get(key.name, 'json') as UserSettings;
            const notifiedIds = new Set(user.lastNotifiedIds || []);
            const dealsToNotify = [];

            for (const p of products) {
                if (notifiedIds.has(String(p.productId))) continue;

                // Simple check: is price lower than user's target?
                // Note: Simplified logic for boilerplate
                const isBlink = (p.product || '').toLowerCase().includes('blink');
                if (isBlink && user.notifyBlinkdeals) {
                    dealsToNotify.push(p);
                } else if (user.targetPrice24K && (p.price / 10) < user.targetPrice24K) {
                    dealsToNotify.push(p);
                }
            }

            if (dealsToNotify.length > 0) {
                const firstDeal = dealsToNotify[0];
                const success = await sendPush(user.subscription, {
                    title: `Gold Alert: ${firstDeal.product}`,
                    body: `Price hit! ₹${firstDeal.price} available now.`,
                    url: `https://www.myntra.com/${firstDeal.landingPageUrl}`
                }, env);

                if (success === true) {
                    user.lastNotifiedIds = [...notifiedIds, ...dealsToNotify.map(d => String(d.productId))];
                    user.lastNotifiedAt = Date.now();
                    await env.ALERTS_STORAGE.put(key.name, JSON.stringify(user));
                } else if (success === 'expired') {
                    await env.ALERTS_STORAGE.delete(key.name);
                }
            }
        }
    }
};
