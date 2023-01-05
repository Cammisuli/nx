import {hash, sum} from '../index';

describe('core', () => {
  it('should hash', () => {
    expect(hash('Test')).toMatchInlineSnapshot(`12967476824633224542n`);
  });

  it('should sum', () => {
    expect(sum(1, 2)).toBe(3)
  })
});
