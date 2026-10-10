import { buildMapHtml, buildMoveScript } from './mapHtml';

describe('buildMoveScript', () => {
  it('builds a call to window.moveBus with the coordinates', () => {
    expect(buildMoveScript(6.9271, 79.8612)).toBe('window.moveBus(6.9271, 79.8612); true;');
  });

  it('refuses non-finite coordinates', () => {
    expect(buildMoveScript(NaN, 79.8)).toBeNull();
    expect(buildMoveScript(6.9, Infinity)).toBeNull();
  });
});

describe('buildMapHtml', () => {
  it('defines moveBus and loads Leaflet', () => {
    const html = buildMapHtml();
    expect(html).toContain('window.moveBus');
    expect(html).toContain('leaflet');
    expect(html).toContain('<div id="map">');
  });
});
