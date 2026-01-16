/**
 * HTML Utility Functions
 *
 * Security utilities for handling HTML content safely.
 */

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Use this when inserting user-controlled data into HTML templates.
 *
 * @param text - The text to escape
 * @returns Escaped text safe for HTML insertion
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape HTML and convert newlines to <br> tags.
 * Useful for preserving line breaks in user-entered text.
 *
 * @param text - The text to escape and convert
 * @returns Escaped text with newlines as <br> tags
 */
export function escapeHtmlWithLineBreaks(text: string | null | undefined): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
