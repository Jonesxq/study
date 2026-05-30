import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/(public)/page';

describe('HomePage', () => {
  it('renders the Chinese public shell', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '最近在想什么' })).toBeTruthy();
    expect(screen.getByText('未闲漫步')).toBeTruthy();
    expect(screen.getByRole('link', { name: '笔记' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '标签' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '搜索' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '关于' })).toBeTruthy();
  });
});
