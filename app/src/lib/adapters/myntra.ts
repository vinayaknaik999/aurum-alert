import { parseWeight, isBlinkdeal } from '../utils/gold';
import type { GoldProduct } from '../types';

export function processMyntraProduct(p: any): GoldProduct | null {
    if (!p || !p.productId) return null;

    const title = p.product || p.productName || '';
    const weight = parseWeight(p.additionalInfo || title);
    if (!weight) return null;

    const price = p.price;
    const mrp = p.mrp || price;

    return {
        id: String(p.productId),
        title,
        brand: p.brand || '',
        imageUrl: p.searchImage || '',
        buyUrl: `https://www.myntra.com/${p.landingPageUrl || ''}`,
        price,
        mrp,
        weight,
        perGram: Math.round(price / weight),
        isBlink: isBlinkdeal(title, p.couponData?.couponDescription || '')
    };
}
