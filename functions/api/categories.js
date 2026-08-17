/**
 * GET /api/categories → the site's categories (D1-backed, defaults as fallback).
 * Public + cached briefly like /api/products, so a new category the owner adds
 * shows on the homepage rail and the /categories hub within a minute, no deploy.
 */
import { loadCategories } from '../_categories.js';

export async function onRequest(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const categories = await loadCategories(env);
  return new Response(JSON.stringify({ success: true, categories }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      ...cors,
    },
  });
}
