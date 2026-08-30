import { describe, it, expect } from 'bun:test';
import { parseLine } from '../prepare';

describe('prepare line parsing', () => {
  it('parses stage markers into events', () => {
    const events: string[][] = [];
    parseLine('[prepare:docker] Installing Docker...', (stage, message) => events.push([stage, message]));
    expect(events).toEqual([['docker', 'Installing Docker...']]);
  });

  it('emits unmarked output as raw lines', () => {
    const events: string[][] = [];
    parseLine('Some output from the remote', (stage, message) => events.push([stage, message]));
    expect(events).toEqual([['output', 'Some output from the remote']]);
  });

  it('ignores empty lines', () => {
    const events: string[][] = [];
    parseLine('   ', (stage, message) => events.push([stage, message]));
    expect(events).toEqual([]);
  });
});