export function parseWeight(title: string): number | null {
    const match = title.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:gm|gram|g)/);
    return match ? parseFloat(match[1]) : null;
}

export function isBlinkdeal(title: string, description: string = ''): boolean {
    const search = (title + ' ' + description).toLowerCase();
    return search.includes('blink');
}

export function formatPrice(amt: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amt);
}
