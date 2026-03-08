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

// ── SPOT PRICE ENGINE ────────────────────────────────────────────────────────
const TROY_OZ_TO_GRAM = 31.1035;
const IMPORT_DUTY = 0.06; // 6% current India import duty
const GST = 0.03;         // 3% GST on gold/silver

const PURITY = {
    '24K': 1.0000,
    '22K': 0.9167,
    '18K': 0.7500,
};

async function fetchSpotPrices() {
    const [goldRes, silverRes, fxRes] = await Promise.all([
        fetch('https://api.gold-api.com/price/XAU'),
        fetch('https://api.gold-api.com/price/XAG'),
        fetch('https://api.frankfurter.app/latest?from=USD&to=INR'),
    ]);

    const [goldData, silverData, fxData]: any[] = await Promise.all([
        goldRes.json(),
        silverRes.json(),
        fxRes.json(),
    ]);

    return {
        goldSpotUSD: goldData.price,
        silverSpotUSD: silverData.price,
        usdInr: fxData.rates.INR,
    };
}

function calcINRperGram(spotUSD: number, usdInr: number) {
    return (spotUSD / TROY_OZ_TO_GRAM) * usdInr * (1 + IMPORT_DUTY) * (1 + GST);
}

async function fetchGoldRate() {
    try {
        const { goldSpotUSD, silverSpotUSD, usdInr } = await fetchSpotPrices();

        const base24K = calcINRperGram(goldSpotUSD, usdInr);
        const baseSilver = calcINRperGram(silverSpotUSD, usdInr);

        return {
            rate24KT: Math.round(base24K),
            rate22KT: Math.round(base24K * PURITY['22K']),
            rate18KT: Math.round(base24K * PURITY['18KT']),
            silver999: Math.round(baseSilver),
            updatedAt: new Date().toISOString(),
            source: 'spot-price-engine',
        };
    } catch {
        return {
            rate24KT: 9200,
            rate22KT: 8433,
            rate18KT: 6900,
            silver999: 90,
            updatedAt: new Date().toISOString(),
            source: 'hardcoded-fallback',
        };
    }
}

// ── SCRAPER LOGIC ─────────────────────────────────────────────────────────────
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
