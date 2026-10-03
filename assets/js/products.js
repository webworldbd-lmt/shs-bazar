// Products Data Management & Firestore Helper Functions
import { db, collection, getDocs, doc, getDoc, query, where, limit, onSnapshot } from './firebase-config.js';
import { isProductInWishlist } from './auth.js';

export const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23F4F6F9'/%3E%3Cg transform='translate(100, 90)'%3E%3Crect x='0' y='0' width='100' height='80' rx='8' fill='none' stroke='%239CA3AF' stroke-width='6'/%3E%3Ccircle cx='30' cy='30' r='10' fill='%239CA3AF'/%3E%3Cpath d='M10 70 L35 40 L55 60 L70 45 L90 70 Z' fill='%239CA3AF'/%3E%3C/g%3E%3Ctext x='50%25' y='68%25' dominant-baseline='middle' text-anchor='middle' fill='%230B4D3C' font-size='18' font-weight='700' font-family='sans-serif'%3EMarket Koro%3C/text%3E%3C/svg%3E";

export function getOptimizedImageUrl(url, width = 300, quality = 'auto') {
  if (!url || typeof url !== 'string') return FALLBACK_IMAGE;
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    // If transformations are already present, preserve or update them cleanly
    if (url.includes('/f_auto') || url.includes('/w_') || url.includes('/q_')) {
      return url;
    }
    const params = `f_auto,q_${quality},w_${width},c_limit`;
    return url.replace('/upload/', `/upload/${params}/`);
  }
  return url;
}

// Fallback initial categories array as defined in requirement (Empty by default)
export const DEFAULT_CATEGORIES = [];

let cachedCategories = null;

export function clearCategoryCache() {
  cachedCategories = null;
  try {
    sessionStorage.removeItem('mk_cached_categories');
  } catch (e) {}
}

export async function fetchActiveCategories(forceRefresh = false) {
  if (!forceRefresh && cachedCategories && Array.isArray(cachedCategories)) {
    return cachedCategories;
  }
  if (!forceRefresh) {
    try {
      const sessionData = sessionStorage.getItem('mk_cached_categories');
      if (sessionData) {
        cachedCategories = JSON.parse(sessionData);
        if (Array.isArray(cachedCategories)) {
          return cachedCategories;
        }
      }
    } catch (e) {
      console.warn('sessionStorage categories read error:', e);
    }
  }

  try {
    const snap = await getDocs(collection(db, 'categories'));
    const list = [];
    const seenKeys = new Set();
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.isActive !== false) {
        const catId = data.slug || docSnap.id;
        const normKey = (catId || '').toLowerCase().trim();
        if (!seenKeys.has(normKey)) {
          seenKeys.add(normKey);
          list.push({
            id: catId,
            name: data.name,
            icon: data.icon || 'fa-folder',
            image: data.image || '',
            docId: docSnap.id,
            ...data
          });
        }
      }
    });

    cachedCategories = list;
    try {
      sessionStorage.setItem('mk_cached_categories', JSON.stringify(list));
    } catch (e) {}
    return list;
  } catch (err) {
    console.warn('Error fetching categories from Firestore:', err);
  }
  cachedCategories = DEFAULT_CATEGORIES;
  return DEFAULT_CATEGORIES;
}

/**
 * Realtime subscription listener for active categories.
 */
export function subscribeToActiveCategories(onData, onError) {
  try {
    const q = collection(db, 'categories');
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        const seenKeys = new Set();
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.isActive !== false) {
            const catId = data.slug || docSnap.id;
            const normKey = (catId || '').toLowerCase().trim();
            if (!seenKeys.has(normKey)) {
              seenKeys.add(normKey);
              list.push({
                id: catId,
                name: data.name,
                icon: data.icon || 'fa-folder',
                image: data.image || '',
                docId: docSnap.id,
                ...data
              });
            }
          }
        });
        cachedCategories = list;
        try {
          sessionStorage.setItem('mk_cached_categories', JSON.stringify(list));
        } catch (e) {}
        if (typeof onData === 'function') onData(list);
      },
      (error) => {
        console.error('[subscribeToActiveCategories] Listener error:', error);
        if (typeof onError === 'function') onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('[subscribeToActiveCategories] Setup error:', err);
    if (typeof onError === 'function') onError(err);
    return () => {};
  }
}

let cachedPublishedProducts = null;

export async function fetchPublishedProducts(limitCount = null, retries = 3, delayMs = 1000) {
  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    try {
      attempt++;
      let q = query(collection(db, 'products'), where('status', '==', 'published'));
      if (limitCount && Number(limitCount) > 0) {
        q = query(collection(db, 'products'), where('status', '==', 'published'), limit(Number(limitCount)));
      }

      const fetchPromise = getDocs(q);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Firestore query timeout (Attempt ${attempt}/${retries})`)), 8000)
      );

      const snap = await Promise.race([fetchPromise, timeoutPromise]);
      const products = [];
      snap.forEach(docSnap => {
        products.push({ id: docSnap.id, ...docSnap.data() });
      });

      // If Firestore served an empty result from offline cache because network failed
      if (snap.metadata && snap.metadata.fromCache && products.length === 0) {
        throw new Error(`Firestore query returned empty offline cache (Attempt ${attempt}/${retries})`);
      }

      if (products.length > 0 || !limitCount) {
        cachedPublishedProducts = products;
        try {
          sessionStorage.setItem('mk_cached_products', JSON.stringify(products));
        } catch (e) {}
      }

      return products;
    } catch (err) {
      lastError = err;
      console.error(`[fetchPublishedProducts] Attempt ${attempt}/${retries} failed:`, err);
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs * attempt));
      }
    }
  }

  // Soft fallback if cache exists
  try {
    const sessionData = sessionStorage.getItem('mk_cached_products');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.warn('[fetchPublishedProducts] Fetch failed after retries, serving cached products from sessionStorage.');
        return parsed;
      }
    }
  } catch (e) {}

  if (cachedPublishedProducts && cachedPublishedProducts.length > 0) {
    console.warn('[fetchPublishedProducts] Fetch failed after retries, serving memory cached products.');
    return cachedPublishedProducts;
  }

  throw lastError || new Error('Failed to fetch published products from Firestore after retries.');
}

/**
 * Realtime subscription listener helper with proper error handling and unmount callback.
 */
export function subscribeToPublishedProducts(onData, onError) {
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'published'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const products = [];
        snapshot.forEach(docSnap => {
          products.push({ id: docSnap.id, ...docSnap.data() });
        });
        cachedPublishedProducts = products;
        try {
          sessionStorage.setItem('mk_cached_products', JSON.stringify(products));
        } catch (e) {}
        if (typeof onData === 'function') onData(products);
      },
      (error) => {
        console.error('[subscribeToPublishedProducts] Listener error:', error);
        if (typeof onError === 'function') onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('[subscribeToPublishedProducts] Listener setup error:', err);
    if (typeof onError === 'function') onError(err);
    return () => {};
  }
}

export function renderSkeletonCards(count = 4) {
  let items = '';
  for (let i = 0; i < count; i++) {
    items += `
      <div class="product-card skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="product-details" style="padding: 12px;">
          <div class="skeleton-line" style="width: 80%; height: 16px; margin-bottom: 8px;"></div>
          <div class="skeleton-line" style="width: 40%; height: 20px; margin-bottom: 12px;"></div>
          <div class="skeleton-line" style="width: 100%; height: 36px; border-radius: var(--radius-sm);"></div>
        </div>
      </div>
    `;
  }
  return items;
}

export function renderErrorState(message, retryCallbackName) {
  const lang = localStorage.getItem('mk_lang') || 'en';
  const retryText = lang === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Try Again';
  const defaultMsg = lang === 'bn'
    ? 'প্রোডাক্ট লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আপনার নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।'
    : 'Failed to load products. Please check your network connection and try again.';

  return `
    <div class="product-error-state" style="grid-column: 1/-1; text-align: center; padding: 32px 16px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color); margin: 12px 0;">
      <i class="fas fa-exclamation-triangle" style="font-size: 2.2rem; color: #E11D48; margin-bottom: 12px;"></i>
      <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${message || defaultMsg}</h3>
      ${retryCallbackName ? `
        <button onclick="${retryCallbackName}" class="btn-primary" style="margin-top: 10px; padding: 8px 20px; font-size: 0.85rem; border-radius: 8px;">
          <i class="fas fa-sync-alt"></i> ${retryText}
        </button>
      ` : ''}
    </div>
  `;
}

export function renderEmptyState(message) {
  const lang = localStorage.getItem('mk_lang') || 'en';
  const defaultMsg = lang === 'bn' ? 'কোনো প্রোডাক্ট পাওয়া যায়নি' : 'No products found';

  return `
    <div class="product-empty-state" style="grid-column: 1/-1; text-align: center; padding: 36px 16px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); margin: 12px 0;">
      <i class="fas fa-box-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px;"></i>
      <p style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">${message || defaultMsg}</p>
    </div>
  `;
}

export async function fetchProductBySlugOrId(identifier) {
  if (!identifier) return null;
  const fetchPromise = (async () => {
    try {
      // Check by ID
      const docRef = doc(db, 'products', identifier);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      // Check by slug
      const q = query(collection(db, 'products'), where('slug', '==', identifier), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const docSnap = querySnap.docs[0];
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (err) {
      console.warn('Error fetching product detail from Firestore:', err);
    }
    return null;
  })();

  const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 3500));
  return Promise.race([fetchPromise, timeoutPromise]);
}

export function getProductShareUrl(identifier) {
  if (!identifier) return window.location.href;
  return `${window.location.origin}/p/${encodeURIComponent(identifier)}`;
}

export const DEFAULT_BANNERS = [];

let cachedBanners = null;

export function clearBannerCache() {
  cachedBanners = null;
  try {
    sessionStorage.removeItem('mk_cached_banners');
  } catch (e) {}
}

export async function fetchBanners(forceRefresh = false) {
  if (!forceRefresh && cachedBanners && Array.isArray(cachedBanners)) {
    return cachedBanners;
  }
  if (!forceRefresh) {
    try {
      const sessionData = sessionStorage.getItem('mk_cached_banners');
      if (sessionData) {
        cachedBanners = JSON.parse(sessionData);
        if (Array.isArray(cachedBanners)) {
          return cachedBanners;
        }
      }
    } catch (e) {
      console.warn('sessionStorage banners read error:', e);
    }
  }

  try {
    const fetchPromise = (async () => {
      const snap = await getDocs(collection(db, 'banners'));
      const list = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const isEnabled = (data.isEnabled !== undefined) ? data.isEnabled : (data.isActive !== false);
        if (isEnabled && data.image) {
          list.push({
            id: docSnap.id,
            slotId: data.slotId || docSnap.id,
            title: data.title || '',
            subtitle: data.subtitle || '',
            image: data.image,
            linkTo: data.linkTo || data.linkUrl || '',
            position: Number(data.position !== undefined ? data.position : 1),
            isEnabled: true,
            ...data
          });
        }
      });

      // Sort by position / slot order
      list.sort((a, b) => (Number(a.position || 0) - Number(b.position || 0)));

      cachedBanners = list;
      try {
        sessionStorage.setItem('mk_cached_banners', JSON.stringify(list));
      } catch (e) {}
      return list;
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 3000));
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Error fetching banners from Firestore:', err);
    return [];
  }
}

// Generate product card HTML snippet
export function renderProductCard(product) {
  const isDiscounted = product.discountPrice && Number(product.discountPrice) < Number(product.regularPrice);
  const currentPrice = isDiscounted ? product.discountPrice : product.regularPrice;
  const discountPercent = isDiscounted ? Math.round(((product.regularPrice - product.discountPrice) / product.regularPrice) * 100) : 0;
  const isOutOfStock = !product.stock || Number(product.stock) <= 0;
  const productIdOrSlug = product.id || product.slug;
  const productUrl = `product-detail.html?id=${encodeURIComponent(productIdOrSlug)}`;
  const rawImage = product.images && product.images.length > 0 ? product.images[0] : FALLBACK_IMAGE;
  const imageSrc = getOptimizedImageUrl(rawImage, 300);
  const sellerId = product.sellerId || 'admin';

  const lang = localStorage.getItem('mk_lang') || 'en';
  const addToCartText = lang === 'bn' ? 'কার্টে যোগ করুন' : 'Add to Cart';
  const stockOutText = lang === 'bn' ? 'স্টক আউট' : 'Stock Out';

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-thumb">
        <a href="${productUrl}">
          <img src="${imageSrc}" alt="${product.name}" loading="lazy">
        </a>
        ${isDiscounted ? `<span class="discount-badge">-${discountPercent}%</span>` : ''}
        ${isOutOfStock ? `<div class="stock-out-overlay" data-i18n="stockOut">${stockOutText}</div>` : ''}
        <button class="share-btn-card" title="Share Product" onclick="event.preventDefault(); event.stopPropagation(); window.handleCopyProductLink('${product.id}')">
          <i class="fas fa-share-nodes"></i>
        </button>
        <button class="wishlist-btn-card ${isProductInWishlist(product.id) ? 'active' : ''}" onclick="window.handleWishlistToggle('${product.id}', this)">
          <i class="${isProductInWishlist(product.id) ? 'fas' : 'far'} fa-heart"></i>
        </button>
      </div>
      <div class="product-details">
        <a href="${productUrl}">
          <h3 class="product-title">${product.name}</h3>
        </a>
        <div class="product-price-wrap">
          <span class="current-price">৳${currentPrice}</span>
          ${isDiscounted ? `<span class="old-price">৳${product.regularPrice}</span>` : ''}
        </div>
        <button class="add-to-cart-btn ${isOutOfStock ? 'stock-out' : ''}"
          ${isOutOfStock ? 'disabled' : ''}
          onclick="window.handleAddToCart('${product.id}', '${product.name}', ${currentPrice}, '${imageSrc}', '${sellerId}')">
          <i class="fas fa-shopping-cart"></i> <span data-i18n="${isOutOfStock ? 'stockOut' : 'addToCart'}">${isOutOfStock ? stockOutText : addToCartText}</span>
        </button>
      </div>
    </div>
  `;
}
