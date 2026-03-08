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

export interface BaseAdapter {
    fetchProducts(): Promise<any[]>;
    processItems(items: any[]): GoldProduct[];
}
