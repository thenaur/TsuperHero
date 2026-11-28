import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pesoWord, amountWord } from '../js/domain/numbers.js';
import { formatAmount, toCentavos, breakdown } from '../js/domain/money.js';

test('number words used in the document', () => {
  assert.equal(pesoWord(5), 'singko');
  assert.equal(pesoWord(10), 'diyes');
  assert.equal(pesoWord(12), 'dose');
  assert.equal(pesoWord(13), 'trese');
  assert.equal(pesoWord(14), 'katorse');
  assert.equal(pesoWord(15), 'kinse');
  assert.equal(pesoWord(20), 'bente');
  assert.equal(pesoWord(25), 'bayntsinko');
  assert.equal(pesoWord(30), 'trenta');
  assert.equal(pesoWord(50), 'singkwenta');
});

test('compound number words', () => {
  assert.equal(pesoWord(22), 'bente dos');
  assert.equal(pesoWord(37), 'trentay siyete');
  assert.equal(pesoWord(100), 'sandaan');
  assert.equal(pesoWord(120), 'sandaan at bente');
  assert.equal(pesoWord(200), 'dalawang daan');
  assert.equal(amountWord(3750), 'trentay siyete singkwenta');
  assert.equal(amountWord(75), 'setentay singko sentimos');
  for (let n = 0; n <= 999; n++) assert.ok(pesoWord(n).length > 0);
  assert.throws(() => pesoWord(1000));
  assert.throws(() => pesoWord(1.5));
});

test('money formatting and conversion', () => {
  assert.equal(formatAmount(1000), '10.00');
  assert.equal(formatAmount(3750), '37.50');
  assert.equal(formatAmount(5), '0.05');
  assert.equal(toCentavos(12.5), 1250);
  assert.equal(toCentavos(14.75), 1475);
  assert.equal(toCentavos(0.1 + 0.2), 30); // no float errors
  assert.deepEqual(breakdown(2000, [1000, 500, 100]), [1000, 1000]);
  assert.equal(breakdown(150, [100]), null);
});
