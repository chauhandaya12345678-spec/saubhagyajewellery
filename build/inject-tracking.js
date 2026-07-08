// Post-build: inject tracking widget into track-orders.html
const fs = require('fs');
const path = require('path');

const widgetPath = path.join(__dirname, 'track-widget.html');
const trackPath = path.join(__dirname, '..', 'track-orders.html');

const widget = fs.readFileSync(widgetPath, 'utf-8');
let track = fs.readFileSync(trackPath, 'utf-8');

// Replace the static "How to track" section with the widget
// The build generates: <p>Use the tracking link in your shipping email...</p>
// We inject the widget after the last </h2> before the WhatsApp button
const placeholder = '<p>Use the tracking link in your shipping email, or message us your order number (it begins with';
const idx = track.indexOf(placeholder);

if (idx < 0) {
    console.error('Could not find injection point in track-orders.html');
    process.exit(1);
}

// Find the end of the prose section to inject
const proseEnd = track.indexOf('<a class="btn" href="https://wa.me', idx);
if (proseEnd < 0) {
    console.error('Could not find WhatsApp button');
    process.exit(1);
}

// Replace everything between the first <h2> in prose and the WhatsApp button
const firstH2 = track.lastIndexOf('<h2>', idx);
if (firstH2 < 0) {
    console.error('Could not find <h2>');
    process.exit(1);
}

const before = track.substring(0, firstH2);
const after = track.substring(proseEnd);
track = before + widget + '\n' + after;

fs.writeFileSync(trackPath, track, 'utf-8');
console.log('✅ Tracking widget injected into track-orders.html');
