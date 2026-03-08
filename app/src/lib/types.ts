export interface GoldProduct {
    id: string;
    title: string;
    brand: string;
    imageUrl: string;
    buyUrl: string;
    price: number;
    mrp: number;
    weight: number;
    perGram: number;
    isBlink: boolean;
}

export interface GoldRate {
    rate24KT: number;
    rate22KT: number;
    updatedAt: string;
}

export interface UserSettings {
    subscription: PushSubscription;
    targetPrice24K: number | null;
    targetPrice22K: number | null;
    notifyBlinkdeals: boolean;
    lastNotifiedAt?: number;
    lastNotifiedIds?: string[];
}
