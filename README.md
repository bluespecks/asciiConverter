# ASCII Studio

A lightweight, browser-based image-to-ASCII converter built using vanilla HTML5, CSS3, and JavaScript.

## Status

**Phase 0: Project Foundation**
- Foundation layout, minimal dark interface, and baseline script initialization.
- No external frameworks, npm packages, or backend services.

## Project Structure

```text
ascii-studio/
├── index.html       # Application markup and structure
├── style.css        # Minimal dark UI styles
├── script.js        # Core JavaScript initialization
├── README.md        # Project documentation
└── .gitignore       # Git ignore rules
```

## How to Run

Since ASCII Studio is a purely client-side static application, you can run it in either of the following ways:

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
You can serve the directory using Python's built-in HTTP server:
```bash
# Navigate to the ascii-studio folder
cd ascii-studio

# Start a local server on port 8000
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.
