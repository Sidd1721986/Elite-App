/**
 * Dimension formatting and parsing utilities for home services (Roofing, Windows & Doors).
 */

export function parseDimensionString(raw?: string): { width: string; height: string; unit: 'in' | 'ft'; notes: string } {
    if (!raw || !raw.trim()) {
        return { width: '', height: '', unit: 'in', notes: '' };
    }
    const trimmed = raw.trim();
    // Matches: [w] [unit] × [h] [unit] [(notes)]  e.g. "36 in × 80 in" or "36" x 80""
    const match = trimmed.match(/^([\d.]+)\s*(in|ft|"|')?\s*(?:[x×]|by)\s*([\d.]+)\s*(in|ft|"|')?(?:\s*\((.*)\))?$/i);
    if (match) {
        const w = match[1];
        const uRaw = (match[2] || match[4] || '').toLowerCase();
        const h = match[3];
        const n = match[5] || '';
        const unit: 'in' | 'ft' = (uRaw === 'ft' || uRaw === "'") ? 'ft' : 'in';
        return { width: w, height: h, unit, notes: n };
    }
    const match2 = trimmed.match(/Width:\s*([\d.]+)\s*(in|ft).*Height:\s*([\d.]+)\s*(in|ft)(?:\s*\((.*)\))?/i);
    if (match2) {
        const unit: 'in' | 'ft' = match2[2].toLowerCase() === 'ft' ? 'ft' : 'in';
        return { width: match2[1], height: match2[3], unit, notes: match2[5] || '' };
    }
    return { width: '', height: '', unit: 'in', notes: trimmed };
}

export function formatDimensionString(width: string, height: string, unit: 'in' | 'ft', notes: string): string {
    const w = width.trim();
    const h = height.trim();
    const n = notes.trim();

    if (w && h) {
        return `${w} ${unit} × ${h} ${unit}${n ? ` (${n})` : ''}`;
    }
    if (w) {
        return `Width: ${w} ${unit}${n ? ` (${n})` : ''}`;
    }
    if (h) {
        return `Height: ${h} ${unit}${n ? ` (${n})` : ''}`;
    }
    return n;
}
