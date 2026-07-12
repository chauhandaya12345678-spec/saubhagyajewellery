/**
 * Saubhagya — /product.html SSR wrapper
 * Same output as /product but keeps the .html URL working for any
 * bookmark, backlink, or Google index entry that still uses it.
 */
import { onRequest as pdpOnRequest } from './product.js';
export const onRequest = pdpOnRequest;
