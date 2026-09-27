import { describe, expect, it } from 'vitest';
import { classifyGoal, goalSignature, recordGoal } from '../goalUpdates';

describe('classifyGoal', () => {
  const first = goalSignature(101, 'S. Aho', []);

  it('calls an unseen eventId a new goal', () => {
    expect(classifyGoal(new Set(), 101, first)).toBe('new');
    expect(classifyGoal(new Set([first]), 102, goalSignature(102, 'S. Aho', []))).toBe('new');
  });

  it('calls the same goal with assists added an update, not a new goal', () => {
    const withAssists = goalSignature(101, 'S. Aho', ['S. Jarvis', 'J. Slavin']);
    expect(classifyGoal(new Set([first]), 101, withAssists)).toBe('update');
  });

  it('calls a scorer change on the same eventId an update', () => {
    expect(classifyGoal(new Set([first]), 101, goalSignature(101, 'S. Jarvis', []))).toBe('update');
  });

  it('ignores a signature it has already shown', () => {
    expect(classifyGoal(new Set([first]), 101, first)).toBe('seen');
  });

  it('does not mistake eventId 10 for 101', () => {
    expect(classifyGoal(new Set([first]), 10, goalSignature(10, 'S. Aho', []))).toBe('new');
  });
});

describe('recordGoal', () => {
  it('replaces the earlier signature for that goal', () => {
    const before = new Set([goalSignature(101, 'S. Aho', []), goalSignature(102, 'J. Staal', [])]);
    const after = recordGoal(before, 101, goalSignature(101, 'S. Aho', ['S. Jarvis']));
    expect([...after].sort()).toEqual(['101:S. Aho:S. Jarvis', '102:J. Staal:']);
  });
});
