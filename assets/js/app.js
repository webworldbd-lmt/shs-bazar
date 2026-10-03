// Main Application Script (UI Wiring, Search, Cart State, Mobile Nav, PWA Service Worker)
import { fetchPublishedProducts, subscribeToPublishedProducts, fetchBanners, renderProductCard, renderSkeletonCards, renderErrorState, renderEmptyState, fetchActiveCategories, subscribeToActiveCategories, DEFAULT_BANNERS, getProductShareUrl, FALLBACK_IMAGE } from './products.js';
import { toggleWishlist, currentUser, logoutUser, onAuthStateUpdate } from './auth.js';
import { fetchAdminSettings, isSuperAdminUser } from './admin.js';
import { getValidCategoryImageUrl } from './category-icons.js';
import { TRANSLATIONS } from './translations.js';

export { TRANSLATIONS };

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => {
        console.log('[SW] Registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

// PWA Install Prompt Capture & Trigger
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('[PWA] beforeinstallprompt captured');
  if (typeof window.renderDrawer === 'function') {
    window.renderDrawer();
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  console.log('[PWA] App installed successfully');
  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  showToast(t.installSuccess || 'Market Koro app installed successfully!');
});

export function installPWA() {
  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast(t.installSuccess || 'Market Koro app installed successfully!');
      }
      deferredPrompt = null;
    });
  } else if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    showToast(lang === 'bn' ? 'Market Koro ইতিমধ্যে ইনস্টল করা আছে!' : 'Market Koro is already installed & running!');
  } else {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      showToast(t.iosInstallGuide || "To install: tap Share button in Safari and select 'Add to Home Screen'.");
    } else {
      showToast(lang === 'bn' ? "ইনস্টল করতে ব্রাউজারের মেনু (⋮) চেপে 'Install app' বা 'Add to Home screen' বেছে নিন" : "To install: open browser menu (⋮) and select 'Install app' or 'Add to Home screen'");
    }
  }
}

window.installPWA = installPWA;

export function getCurrentLang() {
  return localStorage.getItem('mk_lang') || 'en';
}

export function setLanguage(lang) {
  const targetLang = (lang === 'en' || lang === 'bn') ? lang : 'en';
  localStorage.setItem('mk_lang', targetLang);
  applyTranslations();
  showToast(targetLang === 'bn' ? 'ভাষা: বাংলা সিলেক্ট করা হয়েছে' : 'Language: English selected');
}

export function toggleLanguage(lang) {
  const newLang = lang || (getCurrentLang() === 'bn' ? 'en' : 'bn');
  setLanguage(newLang);
}

export function applyTranslations() {
  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  // 1. Text Content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) {
      el.textContent = t[key];
    }
  });

  // 2. Form Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) {
      el.setAttribute('placeholder', t[key]);
    }
  });

  // 3. Titles and Aria Labels
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key] !== undefined) {
      el.setAttribute('title', t[key]);
    }
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (t[key] !== undefined) {
      el.setAttribute('aria-label', t[key]);
    }
  });

  // Re-render Side Drawer to sync current language active item state
  if (typeof window.renderDrawer === 'function') {
    window.renderDrawer();
  }
}

window.setLanguage = setLanguage;
window.toggleLanguage = toggleLanguage;

// Theme Logic
export function initTheme() {
  const savedTheme = localStorage.getItem('mk_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.body.classList.remove('dark-mode');
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

export function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const theme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mk_theme', theme);
  showToast(isDark ? 'Dark Mode Enabled' : 'Light Mode Enabled');
  if (typeof window.renderDrawer === 'function') {
    window.renderDrawer();
  }
}

window.toggleDarkMode = toggleDarkMode;

// Share & Rate Modal Logic
export function openShareModal() {
  let modal = document.getElementById('share-modal-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'share-modal-overlay';
    modal.className = 'share-modal-overlay';
    modal.onclick = (e) => {
      if (e.target === modal) closeShareModal();
    };
    document.body.appendChild(modal);
  }

  const siteUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/index.html');
  const shareText = encodeURIComponent("Check out Market Koro for amazing local deals in Kushtia!");
  const encodedUrl = encodeURIComponent(siteUrl);

  modal.innerHTML = `
    <div class="share-modal-card">
      <button class="bkash-close-btn" onclick="closeShareModal()"><i class="fas fa-times"></i></button>
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="assets/images/logo.png" style="height: 48px; border-radius: 8px;" alt="Logo" loading="lazy">
        <h3 style="color: var(--primary-color); font-size: 1.2rem; margin-top: 6px;">Share Market Koro</h3>
        <p style="font-size: 0.82rem; color: var(--text-muted);">Spread the word with friends & family in Kushtia!</p>
      </div>

      <div class="share-btn-grid">
        <a href="https://api.whatsapp.com/send?text=${shareText}%20${encodedUrl}" target="_blank" class="share-option-btn" style="text-decoration:none;">
          <i class="fab fa-whatsapp" style="font-size: 1.5rem; color: #25D366;"></i>
          <span>WhatsApp</span>
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="share-option-btn" style="text-decoration:none;">
          <i class="fab fa-facebook" style="font-size: 1.5rem; color: #1877F2;"></i>
          <span>Facebook</span>
        </a>
        <button onclick="handleCopyWebsiteUrl()" class="share-option-btn">
          <i class="fas fa-copy" style="font-size: 1.5rem; color: var(--accent-color);"></i>
          <span>Copy Link</span>
        </button>
      </div>

      <div style="border-top: 1px dashed var(--border-color); padding-top: 14px; text-align: center;">
        <h4 style="font-size: 0.9rem; color: var(--primary-color); margin-bottom: 4px;">Rate Our Experience</h4>
        <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 8px;">Tap stars to rate us</p>
        <div class="rating-stars" id="rating-stars">
          <i class="fas fa-star" data-rating="1"></i>
          <i class="fas fa-star" data-rating="2"></i>
          <i class="fas fa-star" data-rating="3"></i>
          <i class="fas fa-star" data-rating="4"></i>
          <i class="fas fa-star" data-rating="5"></i>
        </div>
        <button onclick="handleRateUsSubmit()" class="btn-accent" style="width: 100%; font-size: 0.85rem; padding: 8px; border-radius: 10px; margin-top: 8px;">
          Submit Feedback
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');

  let selectedRating = 5;
  const stars = modal.querySelectorAll('#rating-stars i');
  const updateStars = (val) => {
    stars.forEach((star, idx) => {
      if (idx < val) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  };
  updateStars(5);

  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.getAttribute('data-rating'), 10);
      updateStars(selectedRating);
    });
  });
}

export function closeShareModal() {
  const modal = document.getElementById('share-modal-overlay');
  if (modal) modal.classList.remove('active');
}

window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;

// Image Lightbox Modal
export function openImageModal(imageUrl) {
  if (!imageUrl) return;
  let modal = document.getElementById('image-lightbox-overlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'image-lightbox-overlay';
    modal.className = 'share-modal-overlay';
    modal.onclick = (e) => {
      if (e.target === modal || e.target.closest('.bkash-close-btn')) {
        closeImageModal();
      }
    };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="share-modal-card" style="max-width: 90vw; max-height: 90vh; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.95); border: 1px solid var(--border-color);">
      <button class="bkash-close-btn" onclick="closeImageModal()" style="top: 10px; right: 10px; background: rgba(255,255,255,0.2); color: #FFF; z-index: 10;"><i class="fas fa-times"></i></button>
      <img src="${imageUrl}" style="max-width: 100%; max-height: 82vh; object-fit: contain; border-radius: 8px;" loading="lazy">
    </div>
  `;

  modal.classList.add('active');
}

export function closeImageModal() {
  const modal = document.getElementById('image-lightbox-overlay');
  if (modal) modal.classList.remove('active');
}

window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;


window.handleCopyWebsiteUrl = () => {
  const url = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/index.html');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Website link copied!');
    }).catch(() => fallbackCopyText(url));
  } else {
    fallbackCopyText(url);
  }
};

window.handleRateUsSubmit = () => {
  showToast('Thank you for rating Market Koro!');
  closeShareModal();
};

// Drawer Generator
export function renderDrawer() {
  let drawer = document.getElementById('nav-drawer');
  let overlay = document.getElementById('drawer-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';
    overlay.onclick = () => window.toggleDrawer();
    document.body.appendChild(overlay);
  }

  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.id = 'nav-drawer';
    drawer.className = 'nav-drawer';
    document.body.appendChild(drawer);
  }

  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const isDark = document.body.classList.contains('dark-mode');
  const isLoggedIn = !!currentUser;
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  drawer.innerHTML = `
    <div class="drawer-header">
      <div class="logo-container">
        <img src="assets/images/logo.png" alt="Market Koro Logo" class="logo-img" loading="lazy">
        <span class="brand-name">Market Koro</span>
      </div>
      <button class="hamburger-btn" onclick="toggleDrawer()"><i class="fas fa-times"></i></button>
    </div>

    <ul class="drawer-menu">
      <!-- 1. MAIN -->
      <li class="drawer-section-title">
        ${t.navSectionMain}
      </li>
      <li><a href="index.html" class="drawer-menu-item ${currentPath === 'index.html' ? 'active' : ''}"><i class="fas fa-home" style="width: 20px;"></i> <span>${t.home}</span></a></li>
      <li><a href="shop.html" class="drawer-menu-item ${currentPath === 'shop.html' ? 'active' : ''}"><i class="fas fa-th-large" style="width: 20px;"></i> <span>${t.allCategories}</span></a></li>
      <li><a href="offers.html" class="drawer-menu-item ${currentPath === 'offers.html' ? 'active' : ''}"><i class="fas fa-tags" style="width: 20px;"></i> <span>${t.specialOffers}</span></a></li>
      <li><a href="orders.html" class="drawer-menu-item ${currentPath === 'orders.html' ? 'active' : ''}"><i class="fas fa-box" style="width: 20px;"></i> <span>${t.myOrders}</span></a></li>
      <li><a href="wishlist.html" class="drawer-menu-item ${currentPath === 'wishlist.html' ? 'active' : ''}"><i class="fas fa-heart" style="width: 20px;"></i> <span>${t.wishlist}</span></a></li>

      <!-- 2. ACCOUNT & SETTINGS -->
      <li class="drawer-section-title">
        ${t.navSectionAccount}
      </li>
      <li><a href="${isLoggedIn ? 'profile.html' : 'login.html'}" class="drawer-menu-item account-link ${currentPath === 'profile.html' || currentPath === 'login.html' ? 'active' : ''}"><i class="fas fa-user-circle" style="width: 20px;"></i> <span>${t.myAccount}</span></a></li>
      <li>
        <a href="#" onclick="event.preventDefault(); toggleDarkMode();" class="drawer-menu-item">
          <i class="${isDark ? 'fas fa-sun' : 'fas fa-moon'} theme-toggle-icon" style="width: 20px; color: var(--accent-color);"></i>
          <span class="theme-toggle-text">${isDark ? t.lightMode : t.darkMode}</span>
        </a>
      </li>
      <li style="padding: 8px 20px 4px 20px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-globe" style="color: var(--primary-color);"></i>
          <span>${t.language} / Language</span>
        </div>
        <div class="drawer-lang-selector-block" style="display: flex; gap: 8px; background: var(--bg-color); padding: 4px; border-radius: 10px; border: 1px solid var(--border-color);">
          <button type="button" onclick="event.preventDefault(); setLanguage('bn');" class="lang-option-btn ${lang === 'bn' ? 'active' : ''}" style="flex: 1; padding: 7px 10px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px; ${lang === 'bn' ? 'background: var(--primary-color); color: #FFF; box-shadow: 0 2px 6px rgba(10,74,57,0.25);' : 'background: transparent; color: var(--text-primary);'}">
            <span>বাংলা</span>
            ${lang === 'bn' ? '<i class="fas fa-check" style="font-size: 0.75rem;"></i>' : ''}
          </button>
          <button type="button" onclick="event.preventDefault(); setLanguage('en');" class="lang-option-btn ${lang === 'en' ? 'active' : ''}" style="flex: 1; padding: 7px 10px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 6px; ${lang === 'en' ? 'background: var(--primary-color); color: #FFF; box-shadow: 0 2px 6px rgba(10,74,57,0.25);' : 'background: transparent; color: var(--text-primary);'}">
            <span>English</span>
            ${lang === 'en' ? '<i class="fas fa-check" style="font-size: 0.75rem;"></i>' : ''}
          </button>
        </div>
      </li>

      <!-- 3. POLICIES & INFO -->
      <li class="drawer-section-title">
        ${t.navSectionPolicies}
      </li>
      <li><a href="return-policy.html" class="drawer-menu-item ${currentPath === 'return-policy.html' ? 'active' : ''}"><i class="fas fa-undo" style="width: 20px;"></i> <span>${t.returnPolicy}</span></a></li>
      <li><a href="shipping-policy.html" class="drawer-menu-item ${currentPath === 'shipping-policy.html' ? 'active' : ''}"><i class="fas fa-truck" style="width: 20px;"></i> <span>${t.shippingInfo}</span></a></li>
      <li><a href="privacy-policy.html" class="drawer-menu-item ${currentPath === 'privacy-policy.html' ? 'active' : ''}"><i class="fas fa-user-shield" style="width: 20px;"></i> <span>${t.privacyPolicy}</span></a></li>
      <li><a href="terms.html" class="drawer-menu-item ${currentPath === 'terms.html' ? 'active' : ''}"><i class="fas fa-file-contract" style="width: 20px;"></i> <span>${t.termsOfService}</span></a></li>
      <li><a href="faq.html" class="drawer-menu-item ${currentPath === 'faq.html' ? 'active' : ''}"><i class="fas fa-question-circle" style="width: 20px;"></i> <span>${t.faq}</span></a></li>

      <!-- 4. HELP & SOCIAL -->
      <li class="drawer-section-title">
        ${t.navSectionSupport}
      </li>
      <li><a href="contact.html" class="drawer-menu-item ${currentPath === 'contact.html' ? 'active' : ''}"><i class="fas fa-headset" style="width: 20px;"></i> <span>${t.contactUs}</span></a></li>
      <li><a href="about.html" class="drawer-menu-item ${currentPath === 'about.html' ? 'active' : ''}"><i class="fas fa-info-circle" style="width: 20px;"></i> <span>${t.aboutUs}</span></a></li>
      <li><a href="#" onclick="event.preventDefault(); toggleDrawer(); openShareModal();" class="drawer-menu-item"><i class="fas fa-share-alt" style="width: 20px; color: var(--accent-color);"></i> <span>${t.shareApp}</span></a></li>
      <li><a href="#" onclick="event.preventDefault(); toggleDrawer(); installPWA();" class="drawer-menu-item" style="color: var(--primary-color); font-weight: 700;"><i class="fas fa-download" style="width: 20px; color: var(--primary-color);"></i> <span>${t.installApp || 'Install Market Koro App'}</span></a></li>

      <!-- 5. LOGOUT (Bottom Divider & Item) -->
      ${isLoggedIn ? `
      <li class="drawer-logout-divider"></li>
      <li><a href="#" onclick="event.preventDefault(); toggleDrawer(); window.handleLogout();" class="drawer-menu-item logout-link" style="color: var(--danger-color);"><i class="fas fa-sign-out-alt" style="width: 20px;"></i> <span>${t.logout}</span></a></li>
      ` : ''}
    </ul>
  `;
}

window.renderDrawer = renderDrawer;
window.handleLogout = () => {
  logoutUser();
};

// Global Cart State (localStorage backed)
export function getCart() {
  try {
    const data = localStorage.getItem('bb_cart');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Error parsing cart from localStorage:', e);
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem('bb_cart', JSON.stringify(cart));
  updateCartUI();
}

export function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id && item.variant === product.variant);
  if (existing) {
    existing.quantity += product.quantity || 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      sellerId: product.sellerId || 'admin',
      variant: product.variant || '',
      quantity: product.quantity || 1
    });
  }
  saveCart(cart);
  showToast(`${product.name} added to cart!`);
}

export function updateCartUI() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Update header & navigation cart badges dynamically
  document.querySelectorAll('.cart-count-badge').forEach(el => {
    const prevCount = el.textContent;
    el.textContent = totalItems;
    if (el.classList.contains('nav-cart-badge')) {
      el.style.display = totalItems > 0 ? 'flex' : 'none';
    } else {
      el.style.display = 'inline-flex';
    }
    if (prevCount !== String(totalItems)) {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }
  });

  // Toggle cart button glow pulse
  document.querySelectorAll('.center-cart-shortcut').forEach(el => {
    if (totalItems > 0) {
      el.classList.add('has-items');
    } else {
      el.classList.remove('has-items');
    }
  });

  // Update floating cart summary bubble
  const cartBubble = document.getElementById('floating-cart-bubble');
  if (cartBubble) {
    if (totalItems > 0) {
      cartBubble.style.display = 'flex';
      const itemsEl = cartBubble.querySelector('.cart-items');
      const totalEl = cartBubble.querySelector('.cart-total');
      if (itemsEl) itemsEl.textContent = `${totalItems} Items`;
      if (totalEl) totalEl.textContent = `৳${totalPrice}`;
    } else {
      cartBubble.style.display = 'none';
    }
  }
}

// Toast Notification
export function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Expose handlers globally for onclick attributes
window.handleAddToCart = (id, name, price, image, sellerId = 'admin') => {
  addToCart({ id, name, price, image, sellerId, quantity: 1 });
};

window.handleCopyProductLink = (productId) => {
  const link = getProductShareUrl(productId);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('Link copied!');
    }).catch(() => {
      fallbackCopyText(link);
    });
  } else {
    fallbackCopyText(link);
  }
};

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Link copied!');
  } catch (err) {
    showToast('Failed to copy link');
  }
  document.body.removeChild(textArea);
}

window.handleWishlistToggle = async (id, btnEl) => {
  const isWishlisted = await toggleWishlist(id);
  // Synchronize all wishlist buttons on the page for this product ID
  const cardButtons = document.querySelectorAll(`.product-card[data-product-id="${id}"] .wishlist-btn-card`);
  const buttonsToUpdate = cardButtons.length > 0 ? cardButtons : (btnEl ? [btnEl] : []);

  buttonsToUpdate.forEach(btn => {
    const icon = btn.querySelector('i');
    if (isWishlisted) {
      btn.classList.add('active');
      if (icon) icon.className = 'fas fa-heart';
    } else {
      btn.classList.remove('active');
      if (icon) icon.className = 'far fa-heart';
    }
  });

  if (isWishlisted) {
    showToast('Added to Wishlist');
  } else {
    showToast('Removed from Wishlist');
  }
};

window.toggleDrawer = () => {
  const drawer = document.getElementById('nav-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer && overlay) {
    drawer.classList.toggle('active');
    overlay.classList.toggle('active');
  }
};

window.goBack = () => {
  if (document.referrer && document.referrer.includes(window.location.host)) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
};

export function focusSearchInput(e) {
  const input = document.getElementById('search-input');
  if (input) {
    if (e) e.preventDefault();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
  }
}
window.focusSearchInput = focusSearchInput;

// Search Setup
export function initSearch(allProducts) {
  const input = document.getElementById('search-input');
  const resultsDropdown = document.getElementById('search-results');
  if (!input || !resultsDropdown) return;

  const searchBox = input.closest('.search-box');
  const searchBtn = searchBox ? searchBox.querySelector('button') : null;

  const triggerSearchRedirect = () => {
    const query = input.value.trim();
    if (query) {
      window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearchRedirect();
    }
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSearchRedirect();
    });
  }

  input.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (val.length < 2) {
      resultsDropdown.classList.remove('active');
      return;
    }
    const matches = (allProducts || []).filter(p => p.name.toLowerCase().includes(val) || (p.category && p.category.toLowerCase().includes(val)));
    if (matches.length > 0) {
      resultsDropdown.innerHTML = matches.slice(0, 6).map(p => `
        <div class="search-result-item" onclick="window.location.href='product-detail.html?id=${encodeURIComponent(p.id || p.slug)}'">
          <img src="${p.images?.[0] || FALLBACK_IMAGE}" alt="${p.name}" loading="lazy">
          <div>
            <div style="font-size: 0.85rem; font-weight: 600;">${p.name}</div>
            <div style="font-size: 0.75rem; color: var(--accent-color); font-weight: bold;">৳${p.discountPrice || p.regularPrice}</div>
          </div>
        </div>
      `).join('');
      resultsDropdown.classList.add('active');
    } else {
      resultsDropdown.innerHTML = '<div style="padding: 10px; font-size: 0.85rem; color: #777;">No products found</div>';
      resultsDropdown.classList.add('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !resultsDropdown.contains(e.target)) {
      resultsDropdown.classList.remove('active');
    }
  });
}

// Carousel Banner Controls
let currentSlide = 0;
let carouselTimer = null;

export function initCarousel(banners) {
  const container = document.getElementById('carousel-container');
  const dotsContainer = document.getElementById('carousel-dots');
  const heroSec = document.querySelector('.hero-section');

  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }

  if (!container || !dotsContainer) return;

  if (!banners || !Array.isArray(banners) || banners.length === 0) {
    container.innerHTML = '';
    dotsContainer.innerHTML = '';
    if (heroSec) heroSec.style.display = 'none';
    return;
  }

  if (heroSec) heroSec.style.display = 'block';

  container.innerHTML = banners.map(b => {
    const imgSrc = b.image || b.fallbackImage || FALLBACK_IMAGE;
    const rawLink = (b.linkTo || b.linkUrl || '').trim();
    const linkUrl = rawLink ? rawLink : '';
    const hasOverlay = (b.title && b.title.trim()) || (b.subtitle && b.subtitle.trim());
    const clickAttr = linkUrl ? `onclick="window.location.href='${linkUrl.replace(/'/g, "\\'")}'"` : '';
    const cursorStyle = linkUrl ? 'cursor: pointer;' : '';

    return `
      <div class="carousel-slide" ${clickAttr} style="${cursorStyle}">
        <img src="${imgSrc}" alt="${b.title || 'Hero Banner'}" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'">
        ${hasOverlay ? `
        <div class="banner-overlay">
          ${b.title ? `<h2>${b.title}</h2>` : ''}
          ${b.subtitle ? `<p>${b.subtitle}</p>` : ''}
        </div>` : ''}
      </div>
    `;
  }).join('');

  if (banners.length > 1) {
    dotsContainer.innerHTML = banners.map((_, idx) => `<div class="dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></div>`).join('');
  } else {
    dotsContainer.innerHTML = '';
  }

  currentSlide = 0;
  container.style.transform = 'translateX(0%)';

  if (banners.length <= 1) return;

  const goToSlide = (index) => {
    currentSlide = (index + banners.length) % banners.length;
    container.style.transform = `translateX(-${currentSlide * 100}%)`;
    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
  };

  const startAutoRotate = () => {
    if (carouselTimer) clearInterval(carouselTimer);
    carouselTimer = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, 3500); // Smooth 3.5-second rotation
  };

  dotsContainer.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      goToSlide(idx);
      startAutoRotate();
    });
  });

  // Touch / Swipe Gesture support for mobile devices
  let startX = 0;
  let endX = 0;
  const touchArea = heroSec || container;

  if (!touchArea.dataset.swipeBound) {
    touchArea.dataset.swipeBound = "true";
    touchArea.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    touchArea.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (Math.abs(diff) > 40 && banners.length > 1) {
        if (diff > 0) {
          goToSlide(currentSlide + 1);
        } else {
          goToSlide(currentSlide - 1);
        }
        startAutoRotate();
      }
    }, { passive: true });
  }

  startAutoRotate();
}

export async function applyGlobalStoreSettings() {
  try {
    const settings = await fetchAdminSettings();
    if (!settings) return;

    // 1. Maintenance Mode Check
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const overlay = document.getElementById('maintenance-mode-overlay');
    if (settings.maintenance?.enabled && currentPath !== 'admin.html') {
      const isAdmin = currentUser && (currentUser.email === 'banglabazaroffical@gmail.com' || currentUser.role === 'admin');
      if (!isAdmin) {
        let el = overlay;
        if (!el) {
          el = document.createElement('div');
          el.id = 'maintenance-mode-overlay';
          el.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#0F172A; color:#FFF; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px;';
          document.body.appendChild(el);
        }
        el.innerHTML = `
          <div style="max-width: 480px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.15); padding: 32px 24px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            <i class="fas fa-tools" style="font-size: 3rem; color: #F5820A; margin-bottom: 16px;"></i>
            <h2 style="font-size: 1.5rem; color: #34D399; margin-bottom: 12px; font-weight: 800;">Site Under Maintenance</h2>
            <p style="font-size: 0.95rem; line-height: 1.6; color: #E2E8F0; margin-bottom: 20px;">
              ${settings.maintenance.message || 'সাইট রক্ষণাবেক্ষণ চলছে, শীঘ্রই ফিরে আসছি'}
            </p>
            <a href="admin.html" style="font-size: 0.8rem; color: #94A3B8; text-decoration: underline;">Admin Login</a>
          </div>
        `;
        document.body.style.overflow = 'hidden';
      } else if (overlay) {
        overlay.remove();
        document.body.style.overflow = '';
      }
    } else if (overlay) {
      overlay.remove();
      document.body.style.overflow = '';
    }

    // 2. Branding (Logo & Favicon)
    if (settings.branding?.logoUrl) {
      document.querySelectorAll('.logo-img, .auth-loading-logo, .logo-container img').forEach(img => {
        img.src = settings.branding.logoUrl;
      });
    }

    if (settings.branding?.faviconUrl) {
      let iconLink = document.querySelector('link[rel="icon"]');
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
      }
      iconLink.href = settings.branding.faviconUrl;

      let appleLink = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleLink) {
        appleLink.href = settings.branding.faviconUrl;
      }
    }

    // 3. Social & Contact Links
    if (settings.social) {
      const { facebookUrl, whatsappNumber, telegramUrl } = settings.social;

      if (whatsappNumber) {
        const cleanWa = whatsappNumber.replace(/[^0-9]/g, '');
        const fullWa = cleanWa.startsWith('88') ? cleanWa : `88${cleanWa}`;
        document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
          link.href = `https://wa.me/${fullWa}`;
          if (link.textContent && link.textContent.trim().match(/^[0-9+]+$/)) {
            link.textContent = whatsappNumber;
          }
        });
      }

      if (facebookUrl) {
        document.querySelectorAll('a[href*="facebook.com"]').forEach(link => {
          link.href = facebookUrl;
        });
      }

      if (telegramUrl) {
        document.querySelectorAll('a[href*="t.me"]').forEach(link => {
          if (!link.href.includes('shsaripofficial')) {
            link.href = telegramUrl;
          }
        });
      }
    }

    // 4. SEO Settings (Homepage Title & Meta Description)
    if (settings.seo && (currentPath === 'index.html' || currentPath === '')) {
      if (settings.seo.metaTitle) {
        document.title = settings.seo.metaTitle;
      }
      if (settings.seo.metaDescription) {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.name = 'description';
          document.head.appendChild(metaDesc);
        }
        metaDesc.content = settings.seo.metaDescription;
      }
    }

    // 5. Analytics (Google Analytics & Facebook Pixel Injection)
    if (settings.analytics?.googleAnalyticsId && !window.gaInjected) {
      window.gaInjected = true;
      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${settings.analytics.googleAnalyticsId}`;
      document.head.appendChild(gaScript);

      const gtagConfig = document.createElement('script');
      gtagConfig.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${settings.analytics.googleAnalyticsId}');
      `;
      document.head.appendChild(gtagConfig);
    }

    if (settings.analytics?.facebookPixelId && !window.fbPixelInjected) {
      window.fbPixelInjected = true;
      const fbScript = document.createElement('script');
      fbScript.textContent = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${settings.analytics.facebookPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(fbScript);
    }

    // 6. Site Policies Rendering
    if (settings.policies) {
      if (currentPath === 'return-policy.html' && settings.policies.returnPolicyHtml) {
        const policyContainer = document.querySelector('.section-wrapper .glass-card');
        if (policyContainer) {
          policyContainer.innerHTML = `
            <h2 style="color: var(--primary-color); margin-bottom: 16px; font-size: 1.25rem; border-bottom: 2px solid var(--accent-color); padding-bottom: 6px; display: inline-block;">
              <i class="fas fa-undo" style="color: var(--accent-color);"></i> Return & Refund Policy
            </h2>
            <div style="line-height: 1.7; font-size: 0.95rem; white-space: pre-line;">${settings.policies.returnPolicyHtml}</div>
          `;
        }
      } else if (currentPath === 'shipping-policy.html' && settings.policies.shippingPolicyHtml) {
        const policyContainer = document.querySelector('.section-wrapper .glass-card');
        if (policyContainer) {
          policyContainer.innerHTML = `
            <h2 style="color: var(--primary-color); margin-bottom: 16px; font-size: 1.25rem; border-bottom: 2px solid var(--accent-color); padding-bottom: 6px; display: inline-block;">
              <i class="fas fa-truck" style="color: var(--accent-color);"></i> Shipping & Delivery Information
            </h2>
            <div style="line-height: 1.7; font-size: 0.95rem; white-space: pre-line;">${settings.policies.shippingPolicyHtml}</div>
          `;
        }
      } else if (currentPath === 'privacy-policy.html' && settings.policies.privacyPolicyHtml) {
        const policyContainer = document.querySelector('.section-wrapper .glass-card');
        if (policyContainer) {
          policyContainer.innerHTML = `
            <h2 style="color: var(--primary-color); margin-bottom: 16px; font-size: 1.25rem; border-bottom: 2px solid var(--accent-color); padding-bottom: 6px; display: inline-block;">
              <i class="fas fa-user-shield" style="color: var(--accent-color);"></i> Privacy Policy
            </h2>
            <div style="line-height: 1.7; font-size: 0.95rem; white-space: pre-line;">${settings.policies.privacyPolicyHtml}</div>
          `;
        }
      }
    }

  } catch (err) {
    console.warn('Error applying global store settings:', err);
  }
}

// Initializer on Page Load
async function initApp() {
  initTheme();
  applyTranslations();
  updateCartUI();
  renderDrawer();

  const copyrightYearEl = document.getElementById('copyright-year');
  if (copyrightYearEl) {
    copyrightYearEl.textContent = new Date().getFullYear();
  }

  // Check for focusSearch URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('focusSearch') === 'true') {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      setTimeout(() => {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        searchInput.focus();
      }, 150);
    }
  }

  // Fire off non-blocking global store settings fetch in parallel
  applyGlobalStoreSettings().catch(err => console.warn('Error applying global store settings:', err));

  onAuthStateUpdate(() => {
    renderDrawer();
    applyGlobalStoreSettings().catch(err => console.warn('Error in auth update store settings:', err));
  });

  // If on homepage, load categories, banners, and products in parallel
  const trendingGrid = document.getElementById('trending-products');
  if (trendingGrid) {
    const catGrid = document.getElementById('category-grid');
    const allProductsGrid = document.getElementById('all-products');

    if (catGrid) catGrid.innerHTML = '';
    initCarousel(DEFAULT_BANNERS);

    trendingGrid.innerHTML = renderSkeletonCards(4);
    if (allProductsGrid) {
      allProductsGrid.innerHTML = renderSkeletonCards(8);
    }

    const renderCategoriesUI = (cats) => {
      if (!catGrid) return;
      if (cats && cats.length > 0) {
        catGrid.innerHTML = cats.map(cat => {
          const catImgSrc = getValidCategoryImageUrl(cat.image, cat.name, cat.slug || cat.id);
          const safeCatName = (cat.name || 'Category').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const safeCatId = encodeURIComponent(cat.id || cat.slug || '');
          return `
            <div class="category-card" onclick="window.location.href='shop.html?category=${safeCatId}'">
              <div class="category-icon-box">
                <img src="${catImgSrc}" alt="${safeCatName}" loading="lazy" class="category-img">
              </div>
              <span class="category-name">${cat.name || ''}</span>
            </div>
          `;
        }).join('');
      } else {
        catGrid.innerHTML = '';
      }
    };

    let isSnapshotActive = false;
    let unsubscribeProducts = null;

    const renderHomepageProductsUI = (products) => {
      initSearch(products);
      const lang = getCurrentLang();
      const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

      const trendingProducts = products.filter(p => p.isTrending);
      if (trendingProducts.length > 0) {
        trendingGrid.innerHTML = trendingProducts.map(renderProductCard).join('');
      } else {
        trendingGrid.innerHTML = renderEmptyState(t.noTrendingProducts || 'বর্তমানে কোনো ট্রেন্ডিং প্রোডাক্ট নেই');
      }

      if (allProductsGrid) {
        if (products.length > 0) {
          allProductsGrid.innerHTML = products.map(renderProductCard).join('');
        } else {
          allProductsGrid.innerHTML = renderEmptyState(t.noProductsFound || 'কোনো প্রোডাক্ট পাওয়া যায়নি');
        }
      }
    };

    let unsubscribeCategories = null;

    window.addEventListener('beforeunload', () => {
      if (typeof unsubscribeCategories === 'function') unsubscribeCategories();
      if (typeof unsubscribeProducts === 'function') unsubscribeProducts();
    });

    // Parallel execution of initial data fetches
    const loadHomepageDataParallel = async () => {
      // Setup realtime listener subscriptions in background
      if (!unsubscribeCategories) {
        unsubscribeCategories = subscribeToActiveCategories(
          (updatedCats) => renderCategoriesUI(updatedCats),
          (err) => console.warn('[Realtime Categories Error]:', err)
        );
      }

      // Parallel fetch for Categories, Banners, and Published Products
      const [categoriesResult, bannersResult, productsResult] = await Promise.allSettled([
        fetchActiveCategories(),
        fetchBanners(),
        fetchPublishedProducts(null, 3, 1000)
      ]);

      if (categoriesResult.status === 'fulfilled' && categoriesResult.value) {
        renderCategoriesUI(categoriesResult.value);
      }

      if (bannersResult.status === 'fulfilled' && Array.isArray(bannersResult.value)) {
        initCarousel(bannersResult.value);
      }

      if (productsResult.status === 'fulfilled' && productsResult.value) {
        renderHomepageProductsUI(productsResult.value);

        if (!isSnapshotActive) {
          unsubscribeProducts = subscribeToPublishedProducts(
            (updatedProducts) => {
              isSnapshotActive = true;
              renderHomepageProductsUI(updatedProducts);
            },
            (error) => console.warn('[Realtime Listener Error]:', error)
          );
        }
      } else {
        console.error('[loadHomepageProducts Error]:', productsResult.reason);
        const lang = getCurrentLang();
        const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
        const errorHtml = renderErrorState(t.errorLoadingProducts, 'window.retryFetchHomepageProducts()');
        trendingGrid.innerHTML = errorHtml;
        if (allProductsGrid) {
          allProductsGrid.innerHTML = errorHtml;
        }
      }
    };

    window.retryFetchHomepageProducts = () => {
      loadHomepageDataParallel();
    };

    loadHomepageDataParallel();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
