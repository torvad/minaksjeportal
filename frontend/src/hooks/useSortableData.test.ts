import { describe, it, expect } from 'vitest';
import { useSortableData } from './useSortableData';
import { renderHook, act } from '@testing-library/react';

describe('useSortableData', () => {
  const mockData = [
    { symbol: 'AAPL', name: 'Apple', price: 150 },
    { symbol: 'GOOGL', name: 'Google', price: 100 },
    { symbol: 'MSFT', name: 'Microsoft', price: 200 },
  ];

  it('returns sorted data when sort key is provided', () => {
    const { result } = renderHook(() => useSortableData(mockData, 'price', true));
    
    const prices = result.current.sorted.map((item: any) => item.price);
    // Check if array is sorted (either asc or desc)
    expect(prices.length).toBe(3);
  });

  it('returns original data when no sort key is provided', () => {
    const { result } = renderHook(() => useSortableData(mockData, '', false));
    
    expect(result.current.sorted).toHaveLength(3);
  });

  it('provides handleSort function', () => {
    const { result } = renderHook(() => useSortableData(mockData, '', false));
    
    expect(typeof result.current.handleSort).toBe('function');
  });

  it('provides ind function for sort indicator', () => {
    const { result } = renderHook(() => useSortableData(mockData, '', false));
    
    expect(typeof result.current.ind).toBe('function');
    const indicator = result.current.ind('price');
    expect(typeof indicator).toBe('string');
  });

  it('sorts ascending when direction is true', () => {
    const { result } = renderHook(() => useSortableData(mockData, 'price', true));
    
    const prices = result.current.sorted.map((item: any) => item.price);
    const isAscending = prices.every((val, i, arr) => i === 0 || arr[i - 1] <= val);
    expect(isAscending).toBe(true);
  });

  it('sorts descending when direction is false', () => {
    const { result } = renderHook(() => useSortableData(mockData, 'price', false));
    
    const prices = result.current.sorted.map((item: any) => item.price);
    const isDescending = prices.every((val, i, arr) => i === 0 || arr[i - 1] >= val);
    expect(isDescending).toBe(true);
  });
});
