import { describe, expect, it } from 'vitest';
import { isNewerVersion } from '../src/shared/release';

describe('isNewerVersion', () => {
  it.each([
    ['v0.2.0', '0.1.0', true],
    ['0.1.1', '0.1.0', true],
    ['1.0.0', '0.9.9', true],
    ['0.10.0', '0.9.0', true], // numeric, not alphabetic
    ['v0.1.0', '0.1.0', false],
    ['0.0.9', '0.1.0', false],
    ['0.2.0-beta.1', '0.1.0', false], // pre-releases never prompt
    ['0.2.0', '0.2.0-beta.1', true],
    ['garbage', '0.1.0', false],
  ])('%s vs installed %s → %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});
