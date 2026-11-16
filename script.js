/**
 * asciiConverter — Phase 2: Customisation Controls
 * Lightweight, browser-based image-to-ASCII converter.
 */

// Configuration constants
const DEFAULT_OUTPUT_WIDTH = 100;
const DEFAULT_BRIGHTNESS = 0;
const DEFAULT_CONTRAST = 0;
const FONT_ASPECT_RATIO = 0.5; // Monospace characters are roughly twice as tall as they are wide
const CHARACTER_RAMP = "@#S%?*+;:,. ";
const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// State
let currentObjectUrl = null;
let currentImage = null;
let renderScheduled = false;

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
 * Calculates perceptual luminance (base brightness) of an RGB pixel.
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
 * Calculates contrast adjustment factor for a given contrast slider value (-100 to +100).
 *
 * @param {number} contrast - Contrast setting (-100 to +100).
 * @returns {number} Multiplier factor for contrast adjustment.
 */
function calculateContrastFactor(contrast) {
    const c = (contrast / 100) * 255;
    return (259 * (c + 255)) / (255 * (259 - c));
}

/**
 * Adjusts pixel luminance based on brightness and contrast settings,
 * clamping the result to [0, 255].
 *
 * @param {number} luminance - Base luminance (0-255).
 * @param {number} brightness - Brightness setting (-100 to +100).
 * @param {number} contrastFactor - Calculated contrast multiplier.
 * @returns {number} Adjusted luminance clamped to [0, 255].
 */
function adjustLuminance(luminance, brightness, contrastFactor) {
    // Apply contrast scaling centered around midpoint 128
    const contrastAdjusted = (luminance - 128) * contrastFactor + 128;
    // Apply brightness offset (-100 to +100 maps to -255 to +255)
    const brightnessOffset = (brightness / 100) * 255;
    const finalLuminance = contrastAdjusted + brightnessOffset;
    return Math.max(0, Math.min(255, finalLuminance));
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
 * Converts pixel data into formatted ASCII art text with brightness and contrast adjustments.
 *
 * @param {Uint8ClampedArray} pixels - Raw RGBA pixel array.
 * @param {number} width - Output columns.
 * @param {number} height - Output rows.
 * @param {string} [characters=CHARACTER_RAMP] - Character ramp.
 * @param {number} [brightness=0] - Brightness adjustment (-100 to +100).
 * @param {number} [contrast=0] - Contrast adjustment (-100 to +100).
 * @returns {string} ASCII art string separated by newlines.
 */
function processPixelsToAscii(
    pixels,
    width,
    height,
    characters = CHARACTER_RAMP,
    brightness = 0,
    contrast = 0
) {
    const rows = [];
    const contrastFactor = calculateContrastFactor(contrast);

    for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
            const pixelIndex = (y * width + x) * 4;
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];

            const baseLuminance = calculateBrightness(r, g, b);
            const adjustedLuminance = adjustLuminance(baseLuminance, brightness, contrastFactor);
            row += mapBrightnessToChar(adjustedLuminance, characters);
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
 * Validates whether the character ramp meets minimum criteria (at least 2 characters).
 * Preserves intentional whitespace without trimming.
 *
 * @param {string} ramp - Character ramp sequence.
 * @returns {boolean} True if valid ramp.
 */
function isValidRamp(ramp) {
    return typeof ramp === 'string' && ramp.length >= 2;
}

/**
 * Displays an error message in the general alert container.
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
 * Clears and hides the general error message container.
 */
function clearError() {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.setAttribute('hidden', '');
    }
}

/**
 * Displays a validation message for the character ramp input.
 *
 * @param {string} message - Error description.
 */
function showRampError(message) {
    const rampErrorElement = document.getElementById('ramp-error');
    if (rampErrorElement) {
        rampErrorElement.textContent = message;
        rampErrorElement.removeAttribute('hidden');
    }
}

/**
 * Clears and hides the character ramp error message.
 */
function clearRampError() {
    const rampErrorElement = document.getElementById('ramp-error');
    if (rampErrorElement) {
        rampErrorElement.textContent = '';
        rampErrorElement.setAttribute('hidden', '');
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
    const fileName = file.name || '';
    const extension = fileName.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp'].includes(extension);
}

/**
 * Reads current customisation control settings and generates ASCII output from the loaded image.
 */
function generateAscii() {
    if (!currentImage) return;

    const widthSlider = document.getElementById('width-slider');
    const rampInput = document.getElementById('ramp-input');
    const brightnessSlider = document.getElementById('brightness-slider');
    const contrastSlider = document.getElementById('contrast-slider');

    const targetWidth = widthSlider ? parseInt(widthSlider.value, 10) || DEFAULT_OUTPUT_WIDTH : DEFAULT_OUTPUT_WIDTH;
    const ramp = rampInput ? rampInput.value : CHARACTER_RAMP;
    const brightness = brightnessSlider ? parseInt(brightnessSlider.value, 10) || 0 : 0;
    const contrast = contrastSlider ? parseInt(contrastSlider.value, 10) || 0 : 0;

    if (!isValidRamp(ramp)) {
        showRampError('Character ramp must contain at least 2 characters.');
        return;
    }
    clearRampError();

    try {
        const { width, height } = calculateOutputDimensions(
            currentImage.naturalWidth,
            currentImage.naturalHeight,
            targetWidth
        );

        if (width <= 0 || height <= 0) {
            showError('Image has invalid dimensions.');
            return;
        }

        const pixelData = extractPixelData(currentImage, width, height);
        const asciiText = processPixelsToAscii(pixelData, width, height, ramp, brightness, contrast);

        renderAsciiOutput(asciiText);
    } catch (err) {
        console.error('Error during ASCII conversion:', err);
        showError('An error occurred during ASCII conversion.');
    }
}

/**
 * Throttles live regeneration calls using requestAnimationFrame.
 */
function scheduleRender() {
    if (!currentImage) return;
    if (renderScheduled) return;

    renderScheduled = true;
    requestAnimationFrame(() => {
        renderScheduled = false;
        generateAscii();
    });
}

/**
 * Resets all customisation controls to their default values and regenerates ASCII output.
 */
function resetControls() {
    const widthSlider = document.getElementById('width-slider');
    const widthValue = document.getElementById('width-value');
    const rampInput = document.getElementById('ramp-input');
    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValue = document.getElementById('brightness-value');
    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValue = document.getElementById('contrast-value');

    if (widthSlider) widthSlider.value = DEFAULT_OUTPUT_WIDTH;
    if (widthValue) widthValue.textContent = DEFAULT_OUTPUT_WIDTH;

    if (rampInput) rampInput.value = CHARACTER_RAMP;
    clearRampError();

    if (brightnessSlider) brightnessSlider.value = DEFAULT_BRIGHTNESS;
    if (brightnessValue) brightnessValue.textContent = DEFAULT_BRIGHTNESS;

    if (contrastSlider) contrastSlider.value = DEFAULT_CONTRAST;
    if (contrastValue) contrastValue.textContent = DEFAULT_CONTRAST;

    if (currentImage) {
        generateAscii();
    }
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
        currentImage = img;
        generateAscii();
    };

    img.onerror = () => {
        cleanupObjectUrl();
        currentImage = null;
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
        currentImage = null;
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
 * Binds event listeners to customisation controls.
 */
function setupControlListeners() {
    const widthSlider = document.getElementById('width-slider');
    const widthValue = document.getElementById('width-value');
    if (widthSlider) {
        widthSlider.addEventListener('input', () => {
            if (widthValue) widthValue.textContent = widthSlider.value;
            scheduleRender();
        });
    }

    const rampInput = document.getElementById('ramp-input');
    if (rampInput) {
        rampInput.addEventListener('input', () => {
            const val = rampInput.value;
            if (!isValidRamp(val)) {
                showRampError('Character ramp must contain at least 2 characters.');
            } else {
                clearRampError();
                scheduleRender();
            }
        });
    }

    const brightnessSlider = document.getElementById('brightness-slider');
    const brightnessValue = document.getElementById('brightness-value');
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', () => {
            if (brightnessValue) brightnessValue.textContent = brightnessSlider.value;
            scheduleRender();
        });
    }

    const contrastSlider = document.getElementById('contrast-slider');
    const contrastValue = document.getElementById('contrast-value');
    if (contrastSlider) {
        contrastSlider.addEventListener('input', () => {
            if (contrastValue) contrastValue.textContent = contrastSlider.value;
            scheduleRender();
        });
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetControls);
    }
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

    setupControlListeners();

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
        calculateContrastFactor,
        adjustLuminance,
        mapBrightnessToChar,
        extractPixelData,
        processPixelsToAscii,
        isValidImageFile,
        isValidRamp,
        resetControls,
        CHARACTER_RAMP,
        DEFAULT_OUTPUT_WIDTH,
        DEFAULT_BRIGHTNESS,
        DEFAULT_CONTRAST,
        FONT_ASPECT_RATIO,
        SUPPORTED_MIME_TYPES
    };
}
