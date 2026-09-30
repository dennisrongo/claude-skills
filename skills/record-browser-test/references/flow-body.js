async rec => {
  const $ = selector => document.querySelector(selector);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const choose = async (selector, value) => {
    const el = $(selector);
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(100);
  };
  const rowIds = () => [...document.querySelectorAll('#list li.item')].map(li => li.dataset.id);

  await rec.show({ suite: 'Region filter lists the right rows', step: 'Choose region North', doing: 'selecting North in the region dropdown' });
  await choose('.region', 'North');

  await rec.show({ step: 'Choose city Alpha', doing: 'selecting Alpha in the city dropdown' });
  await choose('.city', 'Alpha');
  await rec.check('Alpha lists 3 rows', rowIds().length, 3);
  await rec.check('Alpha row ids', rowIds(), ['a1b2', 'c3d4', 'e5f6']);

  await rec.show({ step: 'Choose region South then city Gamma', doing: 'selecting South, then Gamma' });
  await choose('.region', 'South');
  await choose('.city', 'Gamma');
  await rec.check('Gamma row ids', rowIds(), ['9z9z', '8y8y']);

  const expectedHeading = 'Gamma school';
  const heading = $('#detail h2').textContent.trim();
  await rec.check('Gamma heading starts as expected', heading.slice(0, expectedHeading.length), expectedHeading);

  return { rowsSeenLast: rowIds().length };
}
