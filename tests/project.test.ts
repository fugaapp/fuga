import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createProject, parseProject } from '../src/core';

const sample = readFileSync(new URL('./fixtures/synthetic-box.fuga', import.meta.url), 'utf8');
const valid = () => JSON.parse(sample);

describe('parseProject', () => {
  it('accepts the sample project and a fresh one', () => {
    expect(parseProject(sample).groups[0].lines).toHaveLength(3);
    expect(() => parseProject(JSON.stringify(createProject({ path: '/a.png', width: 10, height: 10 })))).not.toThrow();
  });

  it('drops unknown keys instead of carrying them along', () => {
    const doc = { ...valid(), __proto__x: 1, extra: { evil: true } };
    expect(Object.keys(parseProject(JSON.stringify(doc)))).not.toContain('extra');
  });

  it.each([
    ['not JSON', '{', /not valid JSON/],
    ['wrong format', JSON.stringify({ format: 'other' }), /not a Fuga project/],
    ['future version', JSON.stringify({ ...valid(), version: 99 }), /Unsupported project version/],
  ])('rejects %s', (_, text, msg) => {
    expect(() => parseProject(text)).toThrow(msg);
  });

  const damaged: [string, (d: any) => void][] = [
    ['NaN coordinate', (d) => (d.groups[0].lines[0].a = [null, 3])],
    ['string coordinate', (d) => (d.origin = ['1', 2])],
    ['unknown axis', (d) => (d.groups[1].axis = '+w')],
    ['negative image size', (d) => (d.image.width = -5)],
    ['absurd image size', (d) => (d.image.height = 1e9)],
    ['zero reference distance', (d) => (d.reference.distance = 0)],
    ['zero sensor', (d) => (d.lens.sensorWidthMm = 0)],
    ['too many lines', (d) => (d.groups[0].lines = Array.from({ length: 501 }, () => d.groups[0].lines[0]))],
    ['bad mode', (d) => (d.mode = '4vp')],
  ];
  it.each(damaged)('rejects a damaged file: %s', (_, mutate) => {
    const d = valid();
    mutate(d);
    expect(() => parseProject(JSON.stringify(d))).toThrow(/damaged/);
  });
});
