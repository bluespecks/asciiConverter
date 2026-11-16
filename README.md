# asciiConverter

A lightweight, browser-based image-to-ASCII converter built using vanilla HTML5, CSS3, and JavaScript with the HTML Canvas API.

## Status

**Phase 3: Export Functionality**
- Canvas-based image processing and perceptual luminance calculation (`0.299*R + 0.587*G + 0.114*B`).
- Character density mapping with aspect ratio compensation for monospace typography.
- Original image preview with responsive scaling.
- Live customisation controls:
  - **Output Width**: Range slider (40 to 200 characters, step 10) with live aspect ratio recalculation.
  - **Custom Character Ramp**: Monospace text input supporting custom character sequences (darkest to lightest), preserving intentional whitespace, with validation (minimum 2 characters).
  - **Brightness Control**: Range slider (-100 to +100) adjusting luminance before character mapping.
  - **Contrast Control**: Range slider (-100 to +100) adjusting contrast centered around mid-luminance with clamping.
  - **Reset Functionality**: Restores all settings to defaults (width: 100, default ramp, brightness: 0, contrast: 0) and immediately regenerates output.
- **Export Controls**:
  - **Download TXT**: Exports the complete current ASCII art as `ascii-art.txt`, strictly preserving all spaces, line breaks, blank rows, and trailing whitespace using the Blob API.
  - **Copy ASCII**: Copies the full ASCII art to the clipboard via the Clipboard API (`navigator.clipboard.writeText`), with fallback handling and visual user feedback ("Copied to clipboard!").
  - **Download PNG**: Renders the complete ASCII art onto a dark-themed canvas with monospace font metrics, padding, and safe dimension scaling, downloading it as `ascii-art.png`.
- **Live Regeneration**: Instant updates via `requestAnimationFrame` without re-uploading the image.
- Input validation supporting PNG, JPG/JPEG, and WebP formats.
- Error handling for invalid files, corrupted images, custom ramp validation, and clipboard permissions.
- Pure vanilla implementation: zero frameworks, zero external dependencies, zero backend.

## Project Structure

```text
asciiConverter/
├── index.html       # Application markup and structure
├── style.css        # Minimal dark UI styles
├── script.js        # Core conversion engine, controls, and export handlers
├── README.md        # Project documentation
└── .gitignore       # Git ignore rules
```

## How to Run

Since `asciiConverter` is a purely client-side static application, you can run it in either of the following ways:

### Option 1: Direct File Access
Open `index.html` directly in any modern web browser:
```bash
# Linux
xdg-open index.html

# macOS
open index.html

# Windows
start index.html
```

### Option 2: Local HTTP Server (Recommended)
You can serve the repository directory using Python's built-in HTTP server:
```bash
# Start a local server on port 8000
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

## How to Use Export Controls

1. **Upload an Image**: Click "Choose an Image" to select a PNG, JPG, or WebP file.
2. **Adjust Settings (Optional)**:
   - Adjust width, character ramp, brightness, or contrast as desired. The ASCII output updates live.
3. **Export Your Artwork**:
   - **Download TXT**: Click "Download TXT" to download `ascii-art.txt`. Open it in any text editor with monospace font.
   - **Copy ASCII**: Click "Copy ASCII" to copy the text to your system clipboard.
   - **Download PNG**: Click "Download PNG" to download a rendered `ascii-art.png` image with a dark background.

## Supported Formats

- PNG (`image/png`)
- JPEG / JPG (`image/jpeg`)
- WebP (`image/webp`)
