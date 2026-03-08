<script lang="ts">
    import { onMount } from "svelte";
    import { Zap } from "lucide-svelte";
    import { formatPrice } from "$lib/utils/gold";
    import type { GoldProduct, GoldRate } from "$lib/types";
    import { processMyntraProduct } from "$lib/adapters/myntra";

    let goldRate = $state<GoldRate | null>(null);
    let deals = $state<GoldProduct[]>([]);
    let loading = $state(true);

    const blinkDealsCount = $derived(deals.filter((d) => d.isBlink).length);

    async function fetchData() {
        try {
            const workerUrl = import.meta.env.VITE_WORKER_URL || "";
            const res = await fetch(`${workerUrl}/api/latest`);
            const data = await res.json();
            goldRate = data.goldRate;
            deals = (data.products || [])
                .map(processMyntraProduct)
                .filter(Boolean) as GoldProduct[];
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            loading = false;
        }
    }

    onMount(fetchData);
</script>

<div class="container">
    <header style="margin-bottom: 3rem; text-align: center;">
        <h1
            class="gold-text mono"
            style="font-size: 2.5rem; letter-spacing: -1px;"
        >
            AURUM ALERT
        </h1>
        <p
            style="color: var(--text-dim); margin-top: 0.5rem; font-weight: 500;"
        >
            Headless Gold Monitoring Boilerplate
        </p>
    </header>

    {#if loading}
        <div class="card" style="text-align: center; padding: 4rem;">
            <div class="mono" style="color: var(--gold);">
                INITIALIZING_ENGINE...
            </div>
        </div>
    {:else}
        <!-- Price Card -->
        <div
            class="card"
            style="display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--gold);"
        >
            <div>
                <div
                    class="mono gold-text"
                    style="font-size: 0.8rem; margin-bottom: 0.25rem;"
                >
                    LIVE_GOLD_RATE / 24KT
                </div>
                <div class="mono" style="font-size: 2rem; font-weight: 700;">
                    {formatPrice(goldRate?.rate24KT || 0)}<span
                        style="font-size: 1rem; color: var(--text-dim);"
                        >/g</span
                    >
                </div>
            </div>
            <div style="text-align: right;">
                <div
                    class="mono"
                    style="color: var(--text-dim); font-size: 0.7rem;"
                >
                    STATUS: ACTIVE
                </div>
                <div
                    class="mono"
                    style="color: var(--success); font-size: 0.7rem;"
                >
                    UP_TO_DATE
                </div>
            </div>
        </div>

        <div
            style="margin: 2rem 0 1rem; display: flex; justify-content: space-between; align-items: center;"
        >
            <h2 class="mono" style="font-size: 1rem;">RECENT_DEALS</h2>
            <div
                class="mono"
                style="color: var(--text-dim); font-size: 0.8rem;"
            >
                COUNT: {deals.length}
                {#if blinkDealsCount > 0}({blinkDealsCount} BLINK){/if}
            </div>
        </div>

        {#each deals.slice(0, 10) as deal}
            <div
                class="card"
                style="padding: 1rem; display: flex; gap: 1rem; align-items: center;"
            >
                <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    style="width: 60px; height: 60px; border-radius: 6px; object-fit: cover; background: #222;"
                />
                <div style="flex: 1; min-width: 0;">
                    <div
                        style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;"
                    >
                        {#if deal.isBlink}
                            <span class="badge badge-blink">BLINK</span>
                        {/if}
                        <h3
                            style="font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;"
                        >
                            {deal.title}
                        </h3>
                    </div>
                    <div
                        class="mono"
                        style="font-size: 0.8rem; color: var(--text-dim);"
                    >
                        {deal.weight}g @
                        <span class="gold-text"
                            >{formatPrice(deal.perGram)}/g</span
                        >
                    </div>
                </div>
                <div style="text-align: right;">
                    <a
                        href={deal.buyUrl}
                        target="_blank"
                        class="mono gold-text"
                        style="text-decoration: none; font-size: 0.8rem; border-bottom: 1px solid var(--gold);"
                        >VIEW_DEAL</a
                    >
                </div>
            </div>
        {/each}

        <!-- Teaser Footer -->
        <footer
            style="margin-top: 4rem; padding: 2rem; border-top: 1px solid var(--border); text-align: center;"
        >
            <div
                class="mono"
                style="font-size: 0.8rem; color: var(--text-dim); margin-bottom: 1rem;"
            >
                EXPERIENCING LAG? GET PRO FEATURES FOR FREE
            </div>
            <a
                href="https://thegolddeals.com"
                target="_blank"
                class="btn-primary mono"
                style="text-decoration: none; display: inline-block;"
            >
                OPEN THEGOLDDEALS.COM
            </a>
            <div
                style="margin-top: 2rem; color: var(--text-dim); font-size: 0.75rem;"
            >
                Includes AJIO, Silver, 18KT, and 5-min Real-time Alerts.
            </div>
        </footer>
    {/if}
</div>

<style>
    :global(body) {
        overflow-x: hidden;
    }
</style>
