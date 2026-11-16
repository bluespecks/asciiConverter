# asciiConverter

A lightweight, browser-based image-to-ASCII converter built using vanilla HTML5, CSS3, and JavaScript with the HTML Canvas API.

## Status

**Phase 1: Core ASCII Conversion Engine**
- Canvas-based image processing and perceptual luminance calculation (`0.299*R + 0.587*G + 0.114*B`).
- Character density mapping with aspect ratio compensation for monospace typography.
- Original image preview with responsive scaling.
- Input validation supporting PNG, JPG/JPEG, and WebP formats.
- Error handling for invalid files and corrupted images.
- Pure vanilla implementation: zero frameworks, zero external dependencies, zero backend.

## Project Structure

```text
asciiConverter/
├── index.html       # Application markup and structure
├── style.css        # Minimal dark UI styles
├── script.js        # Core conversion engine and event handling
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

## Supported Formats

- PNG (`image/png`)
- JPEG / JPG (`image/jpeg`)
- WebP (`image/webp`)
