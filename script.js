/**
 * asciiConverter — Phase 1: Core ASCII Conversion Engine
 * Lightweight, browser-based image-to-ASCII converter.
 */

// Configuration constants
const DEFAULT_OUTPUT_WIDTH = 100;
const FONT_ASPECT_RATIO = 0.5; // Monospace characters are roughly twice as tall as they are wide
const CHARACTER_RAMP = "@#S%?*+;:,. ";
const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// State
let currentObjectUrl = null;

/**
 * Calculates output character dimensions preserving image aspect ratio
 * and compensating for monospace font aspect ratio.
 *
 * @param {number} imageWidth - Natural width of the source image.
 * @param {number} imageHeight - Natural height of the source image.
 * @param {number} [targetWidth=DEFAULT_OUTPUT_WIDTH] - Desired character columns.
 * @returns {{ width: number, height: number }} Output dimensions in characters.
 */
function calculateOutputDimensions(imageWidth, imageHeight, targetWidth = DEFAULT_OUTPUT_WIDTH) {
    if (!imageWidth || !imageHeight || imageWidth <= 0 || imageHeight <= 0) {
        return { width: 0, height: 0 };
    }

    const width = Math.max(1, Math.round(targetWidth));
    const aspectRatio = imageHeight / imageWidth;
    const height = Math.max(1, Math.round(width * aspectRatio * FONT_ASPECT_RATIO));

    return { width, height };
}

/**
 * Calculates perceptual luminance (brightness) of an RGB pixel.
 *
 * @param {number} r - Red channel (0-255).
 * @param {number} g - Green channel (0-255).
 * @param {number} b - Blue channel (0-255).
 * @returns {number} Perceptual brightness value (0-255).
 */
function calculateBrightness(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Maps a brightness value to an ASCII character from the character ramp.
 * Darker pixels map to denser characters; brightest pixels map to spaces.
 *
 * @param {number} brightness - Brightness value (0-255).
 * @param {string} [characters=CHARACTER_RAMP] - Character ramp string.
 * @returns {string} Mapped character.
 */
function mapBrightnessToChar(brightness, characters = CHARACTER_RAMP) {
    const clamped = Math.max(0, Math.min(255, brightness));
    const index = Math.max(
        0,
        Math.min(characters.length - 1, Math.floor((clamped / 256) * characters.length))
    );
    return characters[index];
}

/**
 * Draws the image onto an offscreen canvas and extracts pixel data.
 *
 * @param {HTMLImageElement|CanvasImageSource} image - Source image.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 * @returns {Uint8ClampedArray} Raw RGBA pixel data.
 */
function extractPixelData(image, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Fill white background to gracefully handle transparent PNG/WebP images
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
}

/**
 * Converts pixel data into formatted ASCII art text.
 *
 * @param {Uint8ClampedArray} pixels - Raw RGBA pixel array.
 * @param {number} width - Output columns.
 * @param {number} height - Output rows.
 * @param {string} [characters=CHARACTER_RAMP] - Character ramp.
 * @returns {string} ASCII art string separated by newlines.
 */
function processPixelsToAscii(pixels, width, height, characters = CHARACTER_RAMP) {
    const rows = [];

    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];

            const brightness = calculateBrightness(r, g, b);
            row += mapBrightnessToChar(brightness, characters);
        }
        rows.push(row);
    }

    return rows.join('\n');
}

/**
 * Renders the ASCII art inside the output container using textContent.
 *
 * @param {string} asciiText - Formatted ASCII string.
 */
function renderAsciiOutput(asciiText) {
    const outputElement = document.getElementById('ascii-output');
    if (outputElement) {
        outputElement.textContent = asciiText;
    }
}

/**
 * Displays an error message to the user.
 *
 * @param {string} message - Message text to display.
 */
function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.removeAttribute('hidden');
    }
}

/**
 * Clears and hides the error message container.
 */
function clearError() {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.setAttribute('hidden', '');
    }
}

/**
 * Revokes any active object URL to prevent memory leaks.
 */
function cleanupObjectUrl() {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
    }
}

/**
 * Validates whether the given file is an accepted image format.
 *
 * @param {File} file - File selected by the user.
 * @returns {boolean} True if supported image format.
 */
function isValidImageFile(file) {
    if (!file) return false;
    if (SUPPORTED_MIME_TYPES.includes(file.type)) {
        return true;
    }
    // Fallback validation on file extension if mime type is empty
    const fileName = file.name || '';
    const extension = fileName.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
}

/**
 * Loads an image from a file, updates the preview, and initiates ASCII conversion.
 *
 * @param {File} file - Validated image file.
 */
function loadAndPreviewImage(file) {
    cleanupObjectUrl();

    const previewContainer = document.getElementById('image-preview');
    if (!previewContainer) return;

    currentObjectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.alt = file.name || 'Uploaded preview';

    img.onload = () => {
        try {
            const { width, height } = calculateOutputDimensions(img.naturalWidth, img.naturalHeight);
            if (width <= 0 || height <= 0) {
                showError('Image has invalid dimensions.');
                return;
            }

            const pixelData = extractPixelData(img, width, height);
            const asciiText = processPixelsToAscii(pixelData, width, height);

            renderAsciiOutput(asciiText);
        } catch (err) {
            console.error('Error during ASCII conversion:', err);
            showError('An error occurred during ASCII conversion.');
        }
    };

    img.onerror = () => {
        cleanupObjectUrl();
        if (previewContainer) {
            previewContainer.replaceChildren();
        }
        renderAsciiOutput('');
        showError('Failed to load image. The file may be corrupt or unreadable.');
    };

    img.src = currentObjectUrl;

    // Update preview container with the new image
    previewContainer.replaceChildren(img);
}

/**
 * Handles image selection from the file input.
 *
 * @param {Event} event - Input change event.
 */
function handleImageUpload(event) {
    clearError();

    const files = event.target.files;
    if (!files || files.length === 0) {
        return;
    }

    const file = files[0];

    // Reset input value to allow re-uploading the same file consecutively
    event.target.value = '';

    if (!isValidImageFile(file)) {
        cleanupObjectUrl();
        const previewContainer = document.getElementById('image-preview');
        if (previewContainer) {
            previewContainer.replaceChildren();
        }
        renderAsciiOutput('');
        showError('Please upload a valid image file (PNG, JPG, JPEG, or WebP).');
        return;
    }

    loadAndPreviewImage(file);
}

/**
 * Application initialization.
 */
function init() {
    if (typeof document === 'undefined') return;
    const imageInput = document.getElementById('image-input');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }
    console.log('asciiConverter initialized successfully.');
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// Export functions for testability in Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateOutputDimensions,
        calculateBrightness,
        mapBrightnessToChar,
        extractPixelData,
        processPixelsToAscii,
        isValidImageFile,
        CHARACTER_RAMP,
        DEFAULT_OUTPUT_WIDTH,
        FONT_ASPECT_RATIO,
        SUPPORTED_MIME_TYPES
    };
}
