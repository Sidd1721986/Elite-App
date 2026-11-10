import { parseDimensionString, formatDimensionString } from '../dimensionUtils';

describe('Dimension formatting and parsing', () => {
    describe('formatDimensionString', () => {
        it('formats width and height in inches', () => {
            const formatted = formatDimensionString('36', '80', 'in', '');
            expect(formatted).toBe('36 in × 80 in');
        });

        it('formats width and height in feet with notes', () => {
            const formatted = formatDimensionString('30', '40', 'ft', 'Roof section');
            expect(formatted).toBe('30 ft × 40 ft (Roof section)');
        });

        it('formats width only if height is omitted', () => {
            const formatted = formatDimensionString('36', '', 'in', 'Front door');
            expect(formatted).toBe('Width: 36 in (Front door)');
        });

        it('formats height only if width is omitted', () => {
            const formatted = formatDimensionString('', '80', 'in', '');
            expect(formatted).toBe('Height: 80 in');
        });

        it('returns only notes if width and height are empty', () => {
            const formatted = formatDimensionString('', '', 'in', 'Standard 2 car garage door');
            expect(formatted).toBe('Standard 2 car garage door');
        });

        it('returns empty string if all inputs are empty', () => {
            const formatted = formatDimensionString('', '', 'in', '');
            expect(formatted).toBe('');
        });
    });

    describe('parseDimensionString', () => {
        it('parses formatted string with inches', () => {
            const parsed = parseDimensionString('36 in × 80 in');
            expect(parsed.width).toBe('36');
            expect(parsed.height).toBe('80');
            expect(parsed.unit).toBe('in');
            expect(parsed.notes).toBe('');
        });

        it('parses formatted string with feet and notes', () => {
            const parsed = parseDimensionString('30 ft × 40 ft (Roof section)');
            expect(parsed.width).toBe('30');
            expect(parsed.height).toBe('40');
            expect(parsed.unit).toBe('ft');
            expect(parsed.notes).toBe('Roof section');
        });

        it('parses double quotes for inches', () => {
            const parsed = parseDimensionString('36" x 80"');
            expect(parsed.width).toBe('36');
            expect(parsed.height).toBe('80');
            expect(parsed.unit).toBe('in');
        });

        it('parses single quotes for feet', () => {
            const parsed = parseDimensionString("30' x 40'");
            expect(parsed.width).toBe('30');
            expect(parsed.height).toBe('40');
            expect(parsed.unit).toBe('ft');
        });

        it('parses freeform text into notes gracefully', () => {
            const parsed = parseDimensionString('approx 2400 sq ft');
            expect(parsed.width).toBe('');
            expect(parsed.height).toBe('');
            expect(parsed.notes).toBe('approx 2400 sq ft');
        });
    });
});
