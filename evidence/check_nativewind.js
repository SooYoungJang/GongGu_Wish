/**
 * Verify nativewind.config.ts primary values match shared OKLCH tokens
 */
function oklchToHex(l, c, h) {
    var hr = h * Math.PI / 180;
    var a = c * Math.cos(hr);
    var b = c * Math.sin(hr);

    var l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = l - 0.0894841775 * a - 1.2914855480 * b;

    var l3 = l_ * l_ * l_;
    var m3 = m_ * m_ * m_;
    var s3 = s_ * s_ * s_;

    var r_lin =  4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    var g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    var b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    function linear2srgb(c) {
        return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
    }

    function clamp(v) { return Math.max(0, Math.min(255, Math.round(v * 255))); }
    var r = clamp(linear2srgb(r_lin));
    var g = clamp(linear2srgb(g_lin));
    var b = clamp(linear2srgb(b_lin));
    return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

// Shared token primary scale (from colors.ts)
var shared = {
    50:  [0.97, 0.03, 260],
    100: [0.93, 0.06, 260],
    200: [0.88, 0.1, 260],
    300: [0.81, 0.15, 260],
    400: [0.71, 0.19, 260],
    500: [0.58, 0.22, 260],
    600: [0.51, 0.22, 260],
    700: [0.44, 0.20, 260],
    800: [0.37, 0.17, 260],
    900: [0.31, 0.14, 260],
};

// NativeWind config values (from nativewind.config.ts)
var nw = {
    50:  '#eaf6ff',
    100: '#d1e9ff',
    200: '#b1d9ff',
    300: '#86c1ff',
    400: '#559eff',
    500: '#1770f9',
    600: '#0059e0',
    700: '#0045be',
    800: '#003597',
    900: '#002875',
};

console.log('=== Primary Scale: OKLCH→Hex vs NativeWind Config ===');
var allMatch = true;
for (var k of Object.keys(shared).sort(function(a,b){return a-b})) {
    var v = shared[k];
    var expected = oklchToHex(v[0], v[1], v[2]);
    var actual = nw[k];
    var match = expected.toLowerCase() === actual.toLowerCase() ? 'OK' : 'MISMATCH';
    if (match !== 'OK') allMatch = false;
    var diff = match === 'OK' ? '' : '  <<<--- DEV. from ' + expected;
    console.log('  ' + k + ': ' + expected + ' vs ' + actual + ' [' + match + ']' + diff);
}

console.log('\nALL MATCH:', allMatch);

// Additional checks
console.log('\n=== Additional checks ===');
console.log('accent[500] oklch(0.6 0.21 7)  =>', oklchToHex(0.6, 0.21, 7), '(expect #e1306c)');
console.log('noticeText oklch(0.47 0.12 48) =>', oklchToHex(0.47, 0.12, 48), '(was #92400e)');
console.log('neutral[100] oklch(...) => check mobile tokens');
console.log('neutral[200] oklch(...) => check mobile tokens');

// Also validate what the old value was
console.log('\nOld Tailwind blue-500 (#3b82f6) -> matches what?');
console.log('  #3b82f6 is Tailwind blue-500, NOT equivalent to oklch(0.58 0.22 260)');
