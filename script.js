/**
 * asciiConverter — Phase 3: Export Functionality
 * Lightweight, browser-based image-to-ASCII converter.
 */

// Configuration constants
const DEFAULT_OUTPUT_WIDTH = 100;
const DEFAULT_BRIGHTNESS = 0;
const DEFAULT_CONTRAST = 0;
const FONT_ASPECT_RATIO = 0.5; // Monospace characters are roughly twice as tall as they are wide
const CHARACTER_RAMP = "@#S%?*+;:,. ";
const SUPPORTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// PNG export styling constants
const EXPORT_FONT_FAMILY = 'Consolas, "Courier New", Courier, monospace';
const DEFAULT_EXPORT_FONT_SIZE = 14;
const EXPORT_PADDING = 24;
const MAX_CANVAS_DIMENSION = 8192; // Browser safety limit for canvas dimensions

// State
let currentObjectUrl = null;
let currentImage = null;
let currentAsciiText = '';
let renderScheduled = false;
let feedbackTimer = null;

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
    const contrastAdjusted = (luminance - 128) * contrastFactor + 128;
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
 * Enables or disables the export action buttons based on content availability.
 *
 * @param {boolean} hasContent - Whether valid ASCII content is available.
 */
function updateExportButtonsState(hasContent) {
    const copyBtn = document.getElementById('copy-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');

    if (copyBtn) copyBtn.disabled = !hasContent;
    if (downloadTxtBtn) downloadTxtBtn.disabled = !hasContent;
    if (downloadPngBtn) downloadPngBtn.disabled = !hasContent;
}

/**
 * Renders the ASCII art inside the output container using textContent and updates state.
 *
 * @param {string} asciiText - Formatted ASCII string.
 */
function renderAsciiOutput(asciiText) {
    currentAsciiText = asciiText || '';
    const outputElement = document.getElementById('ascii-output');
    if (outputElement) {
        outputElement.textContent = currentAsciiText;
    }
    updateExportButtonsState(Boolean(currentAsciiText));
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
 * Displays feedback status messages for export operations.
 *
 * @param {string} message - Notification text.
 * @param {boolean} [isError=false] - Whether this is an error notification.
 */
function showExportFeedback(message, isError = false) {
    const feedback = document.getElementById('export-feedback');
    if (!feedback) return;

    if (feedbackTimer) {
        clearTimeout(feedbackTimer);
        feedbackTimer = null;
    }

    feedback.textContent = message;
    feedback.className = `export-feedback ${isError ? 'error' : 'success'}`;
    feedback.removeAttribute('hidden');

    feedbackTimer = setTimeout(() => {
        feedback.setAttribute('hidden', '');
        feedback.textContent = '';
        feedback.className = 'export-feedback';
    }, 4000);
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
 * Exports the current ASCII art as a text (.txt) file.
 * Preserves all whitespace and line breaks without trimming.
 */
function downloadTxt() {
    if (!currentAsciiText) {
        showExportFeedback('Please upload an image first before exporting.', true);
        return;
    }

    try {
        const blob = new Blob([currentAsciiText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ascii-art.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showExportFeedback('Downloaded ascii-art.txt successfully.');
    } catch (err) {
        console.error('TXT export failed:', err);
        showExportFeedback('Failed to export TXT file.', true);
    }
}

/**
 * Copies the current ASCII art to the clipboard.
 * Preserves exact whitespace and line breaks.
 */
async function copyToClipboard() {
    if (!currentAsciiText) {
        showExportFeedback('Please upload an image first before exporting.', true);
        return;
    }

    const copyBtn = document.getElementById('copy-btn');
    const originalText = copyBtn ? copyBtn.textContent : 'Copy ASCII';

    function execCommandFallback() {
        const textarea = document.createElement('textarea');
        textarea.value = currentAsciiText;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    }

    let copied = false;

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(currentAsciiText);
            copied = true;
        } catch (clipboardErr) {
            // Fall back to execCommand if writeText fails (e.g. document not focused or permission denied)
            try {
                copied = execCommandFallback();
            } catch (fallbackErr) {
                copied = false;
            }
        }
    } else {
        try {
            copied = execCommandFallback();
        } catch (fallbackErr) {
            copied = false;
        }
    }

    if (copied) {
        showExportFeedback('Copied to clipboard!');
        if (copyBtn) {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }
    } else {
        showExportFeedback('Unable to access clipboard. Check browser permissions.', true);
    }
}

/**
 * Renders the ASCII art text onto a dark-themed canvas with typography metrics and padding.
 *
 * @param {string} asciiText - The ASCII art string to render.
 * @returns {HTMLCanvasElement} Canvas containing rendered ASCII artwork.
 */
function renderAsciiToCanvas(asciiText) {
    if (!asciiText) {
        throw new Error('No ASCII content to render.');
    }

    const lines = asciiText.split('\n');
    let maxLineLength = 0;
    for (const line of lines) {
        if (line.length > maxLineLength) {
            maxLineLength = line.length;
        }
    }

    if (maxLineLength === 0 || lines.length === 0) {
        throw new Error('ASCII content is empty.');
    }

    let fontSize = DEFAULT_EXPORT_FONT_SIZE;
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = `${fontSize}px ${EXPORT_FONT_FAMILY}`;
    let charWidth = measureCtx.measureText('M').width;
    let lineHeight = Math.round(fontSize * 1.25);

    let requiredWidth = Math.ceil(maxLineLength * charWidth + EXPORT_PADDING * 2);
    let requiredHeight = Math.ceil(lines.length * lineHeight + EXPORT_PADDING * 2);

    // Safeguard for unusually large canvas dimensions
    if (requiredWidth > MAX_CANVAS_DIMENSION || requiredHeight > MAX_CANVAS_DIMENSION) {
        const scale = Math.min(
            MAX_CANVAS_DIMENSION / requiredWidth,
            MAX_CANVAS_DIMENSION / requiredHeight
        );
        if (scale < 0.25) {
            throw new Error('Artwork dimensions exceed safe canvas rendering limits.');
        }
        fontSize = Math.max(6, Math.floor(fontSize * scale));
        measureCtx.font = `${fontSize}px ${EXPORT_FONT_FAMILY}`;
        charWidth = measureCtx.measureText('M').width;
        lineHeight = Math.round(fontSize * 1.25);
        requiredWidth = Math.ceil(maxLineLength * charWidth + EXPORT_PADDING * 2);
        requiredHeight = Math.ceil(lines.length * lineHeight + EXPORT_PADDING * 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = requiredWidth;
    canvas.height = requiredHeight;
    const ctx = canvas.getContext('2d');

    // Fill dark background matching application theme (--bg-primary #0d1117)
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set typography and readable light foreground color (--text-primary #e6edf3)
    ctx.font = `${fontSize}px ${EXPORT_FONT_FAMILY}`;
    ctx.fillStyle = '#e6edf3';
    ctx.textBaseline = 'top';

    // Render characters preserving all whitespace and line breaks
    for (let i = 0; i < lines.length; i++) {
        const y = EXPORT_PADDING + i * lineHeight;
        ctx.fillText(lines[i], EXPORT_PADDING, y);
    }

    return canvas;
}

/**
 * Exports the current ASCII art as a rendered PNG image file.
 */
function downloadPng() {
    if (!currentAsciiText) {
        showExportFeedback('Please upload an image first before exporting.', true);
        return;
    }

    try {
        const canvas = renderAsciiToCanvas(currentAsciiText);

        if (canvas.toBlob) {
            canvas.toBlob((blob) => {
                if (!blob) {
                    showExportFeedback('Failed to generate PNG image.', true);
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ascii-art.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                showExportFeedback('Downloaded ascii-art.png successfully.');
            }, 'image/png');
        } else {
            // Data URL fallback
            const dataUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'ascii-art.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showExportFeedback('Downloaded ascii-art.png successfully.');
        }
    } catch (err) {
        console.error('PNG export failed:', err);
        showExportFeedback(err.message || 'Failed to export PNG image.', true);
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
 * Binds event listeners to export buttons.
 */
function setupExportListeners() {
    const copyBtn = document.getElementById('copy-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');

    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }
    if (downloadTxtBtn) {
        downloadTxtBtn.addEventListener('click', downloadTxt);
    }
    if (downloadPngBtn) {
        downloadPngBtn.addEventListener('click', downloadPng);
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
    setupExportListeners();
    updateExportButtonsState(false);

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
        renderAsciiToCanvas,
        downloadTxt,
        downloadPng,
        copyToClipboard,
        getAsciiText: () => currentAsciiText,
        setAsciiText: (text) => { currentAsciiText = text; },
        CHARACTER_RAMP,
        DEFAULT_OUTPUT_WIDTH,
        DEFAULT_BRIGHTNESS,
        DEFAULT_CONTRAST,
        FONT_ASPECT_RATIO,
        SUPPORTED_MIME_TYPES
    };
}
