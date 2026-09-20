/**
 * Everything the map needs at runtime, behind one dynamic import.
 *
 * The stylesheet is the reason this file exists. `maplibre-gl.css` is 81 KB and it is a
 * global import, so importing it anywhere in the normal tree puts it in the first
 * stylesheet the browser blocks on. Pulled in here, it lands in the same asynchronous
 * chunk as the library and arrives after the shell is already on screen. Trap 10 in
 * docs/spec.md exists because this is where a map first product dies.
 *
 * `maplibre-gl` is pinned to 5.24.0 rather than 6.10.0, and the pin is not caution.
 * Measured here on 2026-09-20 against the real archives: on 6.10.0 the pmtiles protocol
 * reads the 16 KB header, gets its 206, and then the vector source never finishes. No
 * error, no rejection, no second request, and `load` never fires, so the map sits on the
 * ground colour forever and nothing in the page says why. The same code on 5.24.0 reads
 * the header, reads the directory, fetches eight tiles and fires `load`. pmtiles 4.5.0 is
 * the current release and its README still documents the 5.x registration, so the fix is
 * the version of MapLibre, not the version of pmtiles. Revisit when pmtiles ships a
 * release that names 6.x.
 */
import 'maplibre-gl/dist/maplibre-gl.css';

export { Map, addProtocol, removeProtocol } from 'maplibre-gl';
export { Protocol } from 'pmtiles';
