import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSeasonality, getRecommendationFromMark } from './services/tvExtendedService';

describe('tvExtendedService', () => {
  describe('computeSeasonality', () => {
    it('returns empty array for insufficient data', () => {
      const result = computeSeasonality([]);
      expect(result).toEqual([]);
    });

    it('returns empty array for less than 30 data points', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        close: 100 + i,
      }));
      expect(computeSeasonality(data)).toEqual([]);
    });

    it('returns 12 months of data for sufficient input', () => {
      // Generate 2 years of weekly data
      const data: { date: string; close: number }[] = [];
      let close = 100;
      for (let year = 2022; year <= 2024; year++) {
        for (let month = 0; month < 12; month++) {
          for (let week = 0; week < 4; week++) {
            const day = Math.min(1 + week * 7, 28);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            close = close * (1 + (Math.random() - 0.5) * 0.05);
            data.push({ date: dateStr, close });
          }
        }
      }
      const result = computeSeasonality(data);
      expect(result.length).toBe(12);
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('avgReturn');
      expect(result[0]).toHaveProperty('years');
      expect(typeof result[0].avgReturn).toBe('number');
    });

    it('month names are correct', () => {
      const data: { date: string; close: number }[] = [];
      let close = 100;
      for (let year = 2020; year <= 2024; year++) {
        for (let month = 0; month < 12; month++) {
          for (let week = 0; week < 4; week++) {
            const day = Math.min(1 + week * 7, 28);
            close = close * (1 + (Math.random() - 0.5) * 0.03);
            data.push({
              date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
              close,
            });
          }
        }
      }
      const result = computeSeasonality(data);
      const expectedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      expect(result.map(r => r.month)).toEqual(expectedMonths);
    });
  });

  describe('getRecommendationFromMark', () => {
    it('returns N/A for null', () => {
      expect(getRecommendationFromMark(null)).toBe('N/A');
    });

    it('returns Strong Buy for 1', () => {
      expect(getRecommendationFromMark(1)).toBe('Strong Buy');
    });

    it('returns Buy for 2', () => {
      expect(getRecommendationFromMark(2)).toBe('Buy');
    });

    it('returns Hold for 3', () => {
      expect(getRecommendationFromMark(3)).toBe('Hold');
    });

    it('returns Sell for 4', () => {
      expect(getRecommendationFromMark(4)).toBe('Sell');
    });

    it('returns Strong Sell for 5', () => {
      expect(getRecommendationFromMark(5)).toBe('Strong Sell');
    });

    it('returns Strong Buy for 1.3', () => {
      expect(getRecommendationFromMark(1.3)).toBe('Strong Buy');
    });

    it('returns Buy for 1.8', () => {
      expect(getRecommendationFromMark(1.8)).toBe('Buy');
    });
  });
});
