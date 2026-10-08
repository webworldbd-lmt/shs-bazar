// Super Admin Management Module
import {
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  query,
  where
} from './firebase-config.js';
import { SUPER_ADMIN_EMAILS } from './auth.js';
import { clearCategoryCache } from './products.js';
import { getValidCategoryImageUrl } from './category-icons.js';

export function isSuperAdminUser(user, profile) {
  if (!user) return false;
  const userEmail = (user.email || '').toLowerCase();
  if (SUPER_ADMIN_EMAILS.some(email => email.toLowerCase() === userEmail)) return true;
  return profile && profile.role === 'admin';
}

// -------------------------------------------------------------
// Brand Icon & Platform Mapping Objects
// -------------------------------------------------------------
export const SOCIAL_PLATFORM_ICONS = {
  tiktok: { name: 'TikTok', iconClass: 'fab fa-tiktok', color: '#000000', bg: '#F1F5F9' },
  instagram: { name: 'Instagram', iconClass: 'fab fa-instagram', color: '#E1306C', bg: '#FDF2F8' },
  youtube: { name: 'YouTube', iconClass: 'fab fa-youtube', color: '#FF0000', bg: '#FEF2F2' },
  twitter: { name: 'Twitter/X', iconClass: 'fab fa-x-twitter', color: '#1DA1F2', bg: '#F0F9FF' },
  linkedin: { name: 'LinkedIn', iconClass: 'fab fa-linkedin', color: '#0A66C2', bg: '#EFF6FF' },
  pinterest: { name: 'Pinterest', iconClass: 'fab fa-pinterest', color: '#E60023', bg: '#FEF2F2' },
  facebook: { name: 'Facebook', iconClass: 'fab fa-facebook', color: '#1877F2', bg: '#EFF6FF' },
  whatsapp: { name: 'WhatsApp', iconClass: 'fab fa-whatsapp', color: '#25D366', bg: '#F0FDF4' },
  telegram: { name: 'Telegram', iconClass: 'fab fa-telegram', color: '#29B6F6', bg: '#F0F9FF' },
  other: { name: 'Other', iconClass: 'fas fa-globe', color: '#0A4A39', bg: '#E6F4E6' }
};

export const PAYMENT_METHOD_ICONS = {
  bkash: { name: 'bKash', iconClass: 'fas fa-mobile-alt', color: '#E2136E', badgeBg: '#E2136E', badgeColor: '#FFFFFF' },
  nagad: { name: 'Nagad', iconClass: 'fas fa-wallet', color: '#F7921E', badgeBg: '#F7921E', badgeColor: '#FFFFFF' },
  rocket: { name: 'Rocket', iconClass: 'fas fa-rocket', color: '#8C3494', badgeBg: '#8C3494', badgeColor: '#FFFFFF' },
  upay: { name: 'Upay', iconClass: 'fas fa-mobile', color: '#005A9C', badgeBg: '#005A9C', badgeColor: '#FFFFFF' },
  bank: { name: 'Bank Transfer', iconClass: 'fas fa-university', color: '#2563EB', badgeBg: '#2563EB', badgeColor: '#FFFFFF' },
  cod: { name: 'Cash on Delivery', iconClass: 'fas fa-money-bill-wave', color: '#16A34A', badgeBg: '#16A34A', badgeColor: '#FFFFFF' },
  other: { name: 'Other', iconClass: 'fas fa-credit-card', color: '#0A4A39', badgeBg: '#0A4A39', badgeColor: '#FFFFFF' }
};

// -------------------------------------------------------------
// 1. Settings CRUD Functions
// -------------------------------------------------------------
let cachedAdminSettings = null;

export function clearAdminSettingsCache() {
  cachedAdminSettings = null;
  try {
    sessionStorage.removeItem('mk_cached_admin_settings');
  } catch (e) {}
}

export async function fetchAdminSettings(forceRefresh = false) {
  if (!forceRefresh && cachedAdminSettings) {
    return cachedAdminSettings;
  }
  if (!forceRefresh) {
    try {
      const sessionData = sessionStorage.getItem('mk_cached_admin_settings');
      if (sessionData) {
        cachedAdminSettings = JSON.parse(sessionData);
        if (cachedAdminSettings) return cachedAdminSettings;
      }
    } catch (e) {
      console.warn('sessionStorage admin settings read error:', e);
    }
  }

  const DEFAULT_AUTO_REPLY = "আসসালামু আলাইকুম স্যার/ম্যাম। আপনি কিছুক্ষণ অপেক্ষা করুন। আমাদের প্রতিনিধি আপনার সাথে শীঘ্রই যোগাযোগ করবে। ধন্যবাদ।";
  const defaultSettings = {
    delivery: { insideKushtia: 100, outsideKushtia: 160 },
    payment: { bKashNumber: '01342697743', codEnabled: true },
    paymentMethods: [
      { id: 'cod_1', method: 'cod', customName: 'Cash on Delivery', number: 'Pay cash upon delivery', enabled: true },
      { id: 'bkash_1', method: 'bkash', customName: 'bKash', number: '01342697743', enabled: true },
      { id: 'nagad_1', method: 'nagad', customName: 'Nagad', number: '01712345678', enabled: true },
      { id: 'rocket_1', method: 'rocket', customName: 'Rocket', number: '01812345678', enabled: true }
    ],
    general: {
      siteName: 'Market Koro',
      hotline: '+8809658183506',
      supportEmail: 'saripofficialsupport@gmail.com',
      autoReply: DEFAULT_AUTO_REPLY
    },
    branding: { logoUrl: '', faviconUrl: '' },
    social: {
      facebookUrl: 'https://facebook.com/marketkoroofficial',
      whatsappNumber: '01342697743',
      telegramUrl: 'https://t.me/marketkoroofficial'
    },
    order: { minOrderAmount: 0, freeDeliveryThreshold: 0, enableFreeDelivery: false, invoicePrefix: 'MK-' },
    policies: { returnPolicyHtml: '', shippingPolicyHtml: '', privacyPolicyHtml: '' },
    maintenance: { enabled: false, message: 'সাইট রক্ষণাবেক্ষণ চলছে, শীঘ্রই ফিরে আসছি' },
    seo: { metaTitle: 'Market Koro - Online Shopping in Kushtia', metaDescription: 'Market Koro offers online shopping in Kushtia, Bangladesh.' },
    analytics: { googleAnalyticsId: '', facebookPixelId: '' }
  };

  try {
    let timeoutId;
    const fetchPromise = Promise.all([
      getDoc(doc(db, 'settings', 'delivery')),
      getDoc(doc(db, 'settings', 'payment')),
      getDoc(doc(db, 'settings', 'general')),
      getDoc(doc(db, 'settings', 'branding')),
      getDoc(doc(db, 'settings', 'social')),
      getDoc(doc(db, 'settings', 'order')),
      getDoc(doc(db, 'settings', 'policies')),
      getDoc(doc(db, 'settings', 'maintenance')),
      getDoc(doc(db, 'settings', 'seo')),
      getDoc(doc(db, 'settings', 'analytics')),
      getDoc(doc(db, 'settings', 'socialLinks')),
      getDoc(doc(db, 'settings', 'paymentMethods'))
    ]);

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Admin settings query timeout')), 5000);
    });

    const [
      deliverySnap,
      paymentSnap,
      generalSnap,
      brandingSnap,
      socialSnap,
      orderSnap,
      policiesSnap,
      maintenanceSnap,
      seoSnap,
      analyticsSnap,
      socialLinksSnap,
      paymentMethodsSnap
    ] = await Promise.race([fetchPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId));

    const generalData = generalSnap.exists() ? generalSnap.data() : {};
    const brandingData = brandingSnap.exists() ? brandingSnap.data() : {};
    const socialData = socialSnap.exists() ? socialSnap.data() : {};
    const orderData = orderSnap.exists() ? orderSnap.data() : {};
    const policiesData = policiesSnap.exists() ? policiesSnap.data() : {};
    const maintenanceData = maintenanceSnap.exists() ? maintenanceSnap.data() : {};
    const seoData = seoSnap.exists() ? seoSnap.data() : {};
    const analyticsData = analyticsSnap.exists() ? analyticsSnap.data() : {};

    // Handle socialLinks array logic with fallbacks
    let socialLinksList = [];
    if (socialLinksSnap && socialLinksSnap.exists()) {
      const data = socialLinksSnap.data();
      socialLinksList = Array.isArray(data) ? data : (data.items || data.links || data.list || []);
    }
    if (!socialLinksList || socialLinksList.length === 0) {
      socialLinksList = [
        { platform: 'facebook', customName: 'Facebook', url: socialData.facebookUrl || defaultSettings.social.facebookUrl },
        { platform: 'whatsapp', customName: 'WhatsApp', url: socialData.whatsappNumber || defaultSettings.social.whatsappNumber },
        { platform: 'telegram', customName: 'Telegram', url: socialData.telegramUrl || defaultSettings.social.telegramUrl }
      ];
    }

    // Handle paymentMethods array logic with fallbacks
    let paymentMethodsList = [];
    if (paymentMethodsSnap && paymentMethodsSnap.exists()) {
      const data = paymentMethodsSnap.data();
      paymentMethodsList = Array.isArray(data) ? data : (data.items || data.methods || data.list || []);
    }
    if (!paymentMethodsList || paymentMethodsList.length === 0) {
      const paymentData = paymentSnap.exists() ? paymentSnap.data() : {};
      paymentMethodsList = [
        { id: 'cod_1', method: 'cod', customName: 'Cash on Delivery', number: 'Pay cash upon delivery', enabled: paymentData.codEnabled !== false },
        { id: 'bkash_1', method: 'bkash', customName: 'bKash', number: paymentData.bKashNumber || defaultSettings.payment.bKashNumber, enabled: true }
      ];
    }

    const settingsResult = {
      delivery: deliverySnap.exists() ? deliverySnap.data() : defaultSettings.delivery,
      payment: paymentSnap.exists() ? paymentSnap.data() : defaultSettings.payment,
      general: { ...defaultSettings.general, ...generalData },
      branding: { ...defaultSettings.branding, ...brandingData },
      social: { ...defaultSettings.social, ...socialData },
      socialLinks: socialLinksList,
      paymentMethods: paymentMethodsList,
      order: { ...defaultSettings.order, ...orderData },
      policies: { ...defaultSettings.policies, ...policiesData },
      maintenance: { ...defaultSettings.maintenance, ...maintenanceData },
      seo: { ...defaultSettings.seo, ...seoData },
      analytics: { ...defaultSettings.analytics, ...analyticsData }
    };

    cachedAdminSettings = settingsResult;
    try {
      sessionStorage.setItem('mk_cached_admin_settings', JSON.stringify(settingsResult));
    } catch (e) {}

    return settingsResult;
  } catch (err) {
    console.warn('Error fetching admin settings, using fallback/cached settings:', err);
    if (cachedAdminSettings) return cachedAdminSettings;
    return defaultSettings;
  }
}

export async function saveAdminDeliverySettings(insideKushtia, outsideKushtia) {
  await setDoc(doc(db, 'settings', 'delivery'), {
    insideKushtia: Number(insideKushtia),
    outsideKushtia: Number(outsideKushtia),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminBrandingSettings(data) {
  await setDoc(doc(db, 'settings', 'branding'), {
    ...data,
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminSocialSettings(data) {
  // Save array as document in settings/socialLinks
  const items = Array.isArray(data) ? data : (data.items || data.links || []);
  await setDoc(doc(db, 'settings', 'socialLinks'), {
    items,
    updatedAt: new Date()
  });

  // Also merge legacy fields if available for backward compatibility
  if (data.facebookUrl || data.whatsappNumber || data.telegramUrl) {
    await setDoc(doc(db, 'settings', 'social'), {
      facebookUrl: data.facebookUrl || '',
      whatsappNumber: data.whatsappNumber || '',
      telegramUrl: data.telegramUrl || '',
      updatedAt: new Date()
    }, { merge: true });
  }

  clearAdminSettingsCache();
}

export async function saveAdminPaymentSettingsList(data) {
  const items = Array.isArray(data) ? data : (data.items || data.methods || []);
  await setDoc(doc(db, 'settings', 'paymentMethods'), {
    items,
    updatedAt: new Date()
  });

  // Also sync legacy settings/payment if bkash or cod exists in list
  const bkashItem = items.find(i => i.method === 'bkash');
  const codItem = items.find(i => i.method === 'cod');
  await setDoc(doc(db, 'settings', 'payment'), {
    bKashNumber: bkashItem ? bkashItem.number : '',
    codEnabled: codItem ? Boolean(codItem.enabled) : true,
    updatedAt: new Date()
  }, { merge: true });

  clearAdminSettingsCache();
}

export async function saveAdminOrderSettings(data) {
  await setDoc(doc(db, 'settings', 'order'), {
    minOrderAmount: Number(data.minOrderAmount || 0),
    freeDeliveryThreshold: Number(data.freeDeliveryThreshold || 0),
    enableFreeDelivery: Boolean(data.enableFreeDelivery),
    invoicePrefix: (data.invoicePrefix || 'MK-').trim(),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminPoliciesSettings(data) {
  await setDoc(doc(db, 'settings', 'policies'), {
    ...data,
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminMaintenanceSettings(data) {
  await setDoc(doc(db, 'settings', 'maintenance'), {
    enabled: Boolean(data.enabled),
    message: (data.message || '').trim(),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminSeoSettings(data) {
  await setDoc(doc(db, 'settings', 'seo'), {
    metaTitle: (data.metaTitle || '').trim(),
    metaDescription: (data.metaDescription || '').trim(),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminAnalyticsSettings(data) {
  await setDoc(doc(db, 'settings', 'analytics'), {
    googleAnalyticsId: (data.googleAnalyticsId || '').trim(),
    facebookPixelId: (data.facebookPixelId || '').trim(),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminPaymentSettings(bKashNumber, codEnabled) {
  await setDoc(doc(db, 'settings', 'payment'), {
    bKashNumber,
    codEnabled: Boolean(codEnabled),
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

export async function saveAdminGeneralSettings(data) {
  await setDoc(doc(db, 'settings', 'general'), {
    ...data,
    updatedAt: new Date()
  }, { merge: true });
  clearAdminSettingsCache();
}

// -------------------------------------------------------------
// 2. Category CRUD Functions
// -------------------------------------------------------------
export function generateCategorySlug(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function invalidateCategoryCache() {
  try {
    clearCategoryCache();
  } catch (e) {}
}

export async function createCategory(categoryData) {
  // Accepts object or positional arguments for backward compatibility
  let name, icon, description, slug, image, isActive;
  if (typeof categoryData === 'string') {
    name = categoryData;
    icon = arguments[1] || 'fa-folder';
    description = arguments[2] || '';
    slug = generateCategorySlug(name);
    image = '';
    isActive = true;
  } else {
    name = categoryData.name;
    slug = categoryData.slug;
    description = categoryData.description;
    image = categoryData.image;
    icon = categoryData.icon;
    isActive = categoryData.isActive;
  }

  name = (name || '').trim();
  if (!name) {
    throw new Error('Category name is required.');
  }

  slug = (slug || '').trim();
  if (!slug) {
    slug = generateCategorySlug(name);
  } else {
    slug = generateCategorySlug(slug);
  }

  if (!slug) {
    throw new Error('Valid category slug is required.');
  }

  // Fetch all existing categories to check duplicate name and duplicate slug
  const allCategories = await fetchCategoriesFromDB();
  const nameLower = name.toLowerCase().trim();
  const slugLower = slug.toLowerCase().trim();

  const duplicateName = allCategories.find(c => (c.name || '').toLowerCase().trim() === nameLower);
  if (duplicateName) {
    throw new Error('এই নামে ইতিমধ্যে একটি ক্যাটাগরি রয়েছে। অনুগ্রহ করে নতুন নাম ব্যবহার করুন। (A category with this name already exists)');
  }

  const duplicateSlug = allCategories.find(c => (c.slug || c.id || '').toLowerCase().trim() === slugLower);
  if (duplicateSlug) {
    throw new Error('এই স্লাগ দিয়ে ইতিমধ্যে একটি ক্যাটাগরি রয়েছে। (This category slug already exists)');
  }

  const docId = slug;
  const docRef = doc(db, 'categories', docId);

  let finalImage = getValidCategoryImageUrl(image, name, slug);

  const payload = {
    name,
    slug,
    description: (description || '').trim(),
    image: finalImage,
    icon: (icon || 'fa-folder').trim(),
    isActive: isActive !== false,
    createdAt: new Date()
  };

  await setDoc(docRef, payload);
  invalidateCategoryCache();
  return { id: docId, ...payload };
}

export async function updateCategory(catId, categoryData) {
  const name = (categoryData.name || '').trim();
  if (!name) {
    throw new Error('Category name is required.');
  }

  let slug = (categoryData.slug || '').trim();
  if (!slug) {
    slug = generateCategorySlug(name);
  } else {
    slug = generateCategorySlug(slug);
  }

  // Check unique name and slug among other categories
  const allCategories = await fetchCategoriesFromDB();
  const nameLower = name.toLowerCase().trim();
  const slugLower = slug.toLowerCase().trim();

  const duplicateName = allCategories.find(c => c.id !== catId && c.slug !== catId && (c.name || '').toLowerCase().trim() === nameLower);
  if (duplicateName) {
    throw new Error('অন্য একটি ক্যাটাগরিতে এই নাম ব্যবহার করা হয়েছে। (A category with this name already exists)');
  }

  const duplicateSlug = allCategories.find(c => c.id !== catId && c.slug !== catId && (c.slug || c.id || '').toLowerCase().trim() === slugLower);
  if (duplicateSlug) {
    throw new Error('অন্য একটি ক্যাটাগরিতে এই স্লাগ ব্যবহার করা হয়েছে। (This category slug already exists)');
  }

  let finalImage = getValidCategoryImageUrl(categoryData.image, name, slug);

  const payload = {
    name,
    slug,
    description: (categoryData.description || '').trim(),
    image: finalImage,
    icon: (categoryData.icon || 'fa-folder').trim(),
    isActive: categoryData.isActive !== false,
    updatedAt: new Date()
  };

  await updateDoc(doc(db, 'categories', catId), payload);
  invalidateCategoryCache();
}

export async function toggleCategoryStatus(catId, currentStatus) {
  await updateDoc(doc(db, 'categories', catId), {
    isActive: !currentStatus,
    updatedAt: new Date()
  });
  invalidateCategoryCache();
}

// -------------------------------------------------------------
// 7. Inventory & Stock Management Helper
// -------------------------------------------------------------
export async function updateProductStock(productId, newStock) {
  const stockNum = Math.max(0, parseInt(newStock, 10) || 0);
  await updateDoc(doc(db, 'products', productId), {
    stock: stockNum,
    updatedAt: new Date()
  });
}

export async function fetchCategoriesFromDB() {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const list = [];
    const updatePromises = [];

    snap.forEach(d => {
      const data = d.data();
      const slug = data.slug || d.id;
      const sanitizedImage = getValidCategoryImageUrl(data.image, data.name, slug);

      // Requirement 4: If database category has an old/incorrect icon value or stale SVG fallback Data URI,
      // overwrite/update it with the current exact mapped icon.
      if (data.image !== sanitizedImage && (data.image?.startsWith('data:image/svg+xml') || !data.image)) {
        updatePromises.push(
          updateDoc(doc(db, 'categories', d.id), {
            image: sanitizedImage,
            updatedAt: new Date()
          }).catch(err => console.warn(`Error auto-updating category ${d.id} icon:`, err))
        );
      }

      list.push({
        id: d.id,
        slug,
        isActive: data.isActive !== false,
        ...data,
        image: sanitizedImage
      });
    });

    if (updatePromises.length > 0) {
      Promise.all(updatePromises).catch(() => {});
    }

    return list;
  } catch (err) {
    console.error('Error fetching categories from DB:', err);
    return [];
  }
}

export async function deleteCategoryFromDB(catId) {
  await deleteDoc(doc(db, 'categories', catId));
  invalidateCategoryCache();
}

// -------------------------------------------------------------
// 3. Product Media & Save Helpers
// -------------------------------------------------------------
export async function compressImage(file, maxDimension = 1200, quality = 0.85) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadMediaFile(file, folderPath = 'products/images', timeoutMs = 25000) {
  if (!file) return null;

  console.log(`Starting Cloudinary upload for file "${file.name}" (${file.type || 'unknown type'}, ${(file.size / 1024).toFixed(1)} KB) to folder "${folderPath}"...`);

  let uploadFile = file;
  try {
    if (file.type && file.type.startsWith('image/')) {
      uploadFile = await compressImage(file);
    }
  } catch (compressErr) {
    console.warn('Image compression warning, proceeding with original file:', compressErr);
    uploadFile = file;
  }

  const cloudName = 'vhc6a9gy';
  const uploadPreset = 'Bangla Bazar';

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('upload_preset', uploadPreset);
  if (folderPath) {
    formData.append('folder', folderPath);
  }

  const isVideo = uploadFile.type && uploadFile.type.startsWith('video');
  const resourceType = isVideo ? 'video' : 'image';
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  console.log(`Cloudinary Upload Request Config:
  - CLOUDINARY_CLOUD_NAME: "${cloudName}"
  - CLOUDINARY_UPLOAD_PRESET: "${uploadPreset}"
  - Endpoint: "${endpoint}"`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const resData = await res.json().catch(() => ({}));

    if (res.ok && resData.secure_url) {
      console.log('Cloudinary upload successful:', resData.secure_url);
      return resData.secure_url;
    }

    const errorMsg = resData.error?.message || (typeof resData === 'object' && Object.keys(resData).length ? JSON.stringify(resData) : `Cloudinary HTTP error ${res.status}`);
    console.error('Cloudinary upload API error response FULL BODY:', JSON.stringify(resData, null, 2));
    console.error('Cloudinary upload API error response:', { status: res.status, errorMsg, resData });
    throw new Error(errorMsg);
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Cloudinary upload exception for file:', file.name, e);
    if (e.name === 'AbortError') {
      throw new Error(`Cloudinary upload timed out after ${timeoutMs / 1000} seconds. Please check your network connection.`);
    }
    throw new Error(e.message || 'Network error during Cloudinary upload');
  }
}

export async function saveAdminProduct(productData, productId = null) {
  try {
    const payload = {
      ...productData,
      sellerId: 'admin',
      sellerName: 'Market Koro Admin',
      updatedAt: new Date()
    };

    if (productId) {
      await updateDoc(doc(db, 'products', productId), payload);
      return productId;
    } else {
      payload.createdAt = new Date();
      payload.status = 'published';
      const docRef = await addDoc(collection(db, 'products'), payload);
      return docRef.id;
    }
  } catch (err) {
    console.error('Error in saveAdminProduct:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// 4. Customers & Users Management Functions
// -------------------------------------------------------------
export async function fetchUsersFromDB() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = [];
    snap.forEach(d => users.push({ id: d.id, ...d.data() }));
    return users;
  } catch (err) {
    console.error('Error fetching users from DB:', err);
    return [];
  }
}

export async function updateUserProfile(userId, data) {
  await updateDoc(doc(db, 'users', userId), {
    ...data,
    updatedAt: new Date()
  });
}

export async function deleteUserDoc(userId) {
  if (!userId) return;

  // 1. Check user profile doc to see if username exists
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData && userData.username) {
        const usernameDocRef = doc(db, 'usernames', userData.username.toLowerCase());
        await deleteDoc(usernameDocRef).catch(err => console.warn('Failed to delete username doc directly:', err));
      }
    }
  } catch (err) {
    console.warn('Error reading user profile before delete:', err);
  }

  // 2. Query usernames collection for any reservation matching this userId/uid to release username handle
  try {
    const usernamesRef = collection(db, 'usernames');
    const q1 = query(usernamesRef, where('userId', '==', userId));
    const snap1 = await getDocs(q1);
    const deletePromises = [];
    snap1.forEach(uDoc => {
      deletePromises.push(deleteDoc(doc(db, 'usernames', uDoc.id)));
    });

    const q2 = query(usernamesRef, where('uid', '==', userId));
    const snap2 = await getDocs(q2);
    snap2.forEach(uDoc => {
      deletePromises.push(deleteDoc(doc(db, 'usernames', uDoc.id)));
    });

    await Promise.allSettled(deletePromises);
  } catch (err) {
    console.warn('Error releasing username reservation:', err);
  }

  // 3. Delete user document from users collection
  await deleteDoc(doc(db, 'users', userId));
}

// -------------------------------------------------------------
// 4. Order Management Functions
// -------------------------------------------------------------
export async function fetchOrdersFromDB() {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    return orders;
  } catch (err) {
    console.error('Error fetching orders from DB:', err);
    return [];
  }
}

export async function updateOrderStatus(orderId, orderStatus) {
  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, {
    orderStatus,
    updatedAt: new Date()
  });
}

export async function updatePaymentStatus(orderId, paymentStatus) {
  await updateDoc(doc(db, 'orders', orderId), {
    paymentStatus,
    updatedAt: new Date()
  });
}

export async function deleteOrderDoc(orderId) {
  await deleteDoc(doc(db, 'orders', orderId));
}

// -------------------------------------------------------------
// 5. Coupon CRUD Functions
// -------------------------------------------------------------
export function normalizeCouponCode(code) {
  return (code || '').toUpperCase().trim().replace(/\s+/g, '');
}

export function validateCouponData(data, existingCoupons = [], currentId = null) {
  const code = normalizeCouponCode(data.code);
  if (!code) {
    throw new Error('Coupon code is required.');
  }

  // Check unique coupon code
  const duplicate = existingCoupons.find(c => normalizeCouponCode(c.code) === code && c.id !== currentId);
  if (duplicate) {
    throw new Error('This coupon code already exists. Please use a unique coupon code.');
  }

  const discountType = data.discountType || 'percentage';
  let discountPercent = 0;
  let flatDiscount = 0;

  if (discountType === 'percentage') {
    discountPercent = Number(data.discountPercent);
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      throw new Error('Discount percentage must be between 1 and 100.');
    }
  } else if (discountType === 'flat') {
    flatDiscount = Number(data.flatDiscount);
    if (isNaN(flatDiscount) || flatDiscount <= 0) {
      throw new Error('Flat discount amount must be greater than 0.');
    }
  } else {
    throw new Error('Invalid discount type selected.');
  }

  const minSpend = Number(data.minSpend || 0);
  if (isNaN(minSpend) || minSpend < 0) {
    throw new Error('Minimum spend must be 0 or a positive number.');
  }

  return {
    code,
    discountType,
    discountPercent,
    flatDiscount,
    minSpend,
    isActive: data.isActive !== false
  };
}

export async function createCoupon(couponData) {
  // Support legacy positional arguments for backward compatibility
  let data;
  if (typeof couponData === 'string') {
    const discountPercent = Number(arguments[1] || 0);
    const flatDiscount = Number(arguments[2] || 0);
    data = {
      code: couponData,
      discountType: discountPercent > 0 ? 'percentage' : 'flat',
      discountPercent,
      flatDiscount,
      minSpend: Number(arguments[3] || 0),
      isActive: arguments[4] !== false
    };
  } else {
    data = couponData;
  }

  const existingCoupons = await fetchCoupons();
  const validated = validateCouponData(data, existingCoupons);

  const docRef = await addDoc(collection(db, 'coupons'), {
    ...validated,
    createdAt: new Date()
  });

  return { id: docRef.id, ...validated };
}

export async function updateCoupon(couponId, couponData) {
  const existingCoupons = await fetchCoupons();
  const validated = validateCouponData(couponData, existingCoupons, couponId);

  await updateDoc(doc(db, 'coupons', couponId), {
    ...validated,
    updatedAt: new Date()
  });
}

export async function fetchCoupons() {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    const coupons = [];
    snap.forEach(d => {
      const data = d.data();
      coupons.push({
        id: d.id,
        code: normalizeCouponCode(data.code),
        discountType: data.discountType || (data.discountPercent ? 'percentage' : 'flat'),
        discountPercent: Number(data.discountPercent || 0),
        flatDiscount: Number(data.flatDiscount || 0),
        minSpend: Number(data.minSpend || 0),
        isActive: data.isActive !== false,
        ...data
      });
    });
    return coupons;
  } catch (err) {
    console.error('Error fetching coupons from DB:', err);
    return [];
  }
}

export async function deleteCoupon(couponId) {
  await deleteDoc(doc(db, 'coupons', couponId));
}

export async function toggleCouponStatus(couponId, currentStatus) {
  await updateDoc(doc(db, 'coupons', couponId), {
    isActive: !currentStatus,
    updatedAt: new Date()
  });
}

// -------------------------------------------------------------
// 6. Hero Banner Slots Management Functions
// -------------------------------------------------------------
export async function saveBannerSlot(slotNumber, slotData, imageFile = null) {
  const slotId = `slot_${slotNumber}`;
  let imageUrl = slotData.image || '';

  if (imageFile) {
    const uploadedUrl = await uploadMediaFile(imageFile, 'banners');
    if (uploadedUrl) {
      imageUrl = uploadedUrl;
    } else {
      throw new Error('Image upload failed');
    }
  }

  const payload = {
    slotId,
    slotNumber: Number(slotNumber),
    title: (slotData.title || `Slot ${slotNumber}`).trim(),
    subtitle: (slotData.subtitle || '').trim(),
    image: imageUrl,
    linkTo: (slotData.linkTo || slotData.linkUrl || '').trim(),
    isEnabled: Boolean(slotData.isEnabled),
    position: Number(slotData.position !== undefined ? slotData.position : slotNumber),
    updatedAt: new Date()
  };

  try {
    await setDoc(doc(db, 'banners', slotId), payload, { merge: true });
  } catch (err) {
    console.error(`[saveBannerSlot] Firestore write error for doc "banners/${slotId}":`, {
      code: err.code,
      message: err.message,
      error: err
    });
    throw err;
  }

  try {
    const { clearBannerCache } = await import('./products.js');
    clearBannerCache();
  } catch (e) {}

  return { id: slotId, ...payload };
}

export async function saveAllBannerSlots(slotsMap) {
  // slotsMap: { 1: { title, image, linkTo, isEnabled, position, file }, ... }
  const savePromises = [];
  for (let slotNum = 1; slotNum <= 8; slotNum++) {
    const slotInfo = slotsMap[slotNum] || {};
    savePromises.push(saveBannerSlot(slotNum, slotInfo, slotInfo.file || null));
  }
  await Promise.all(savePromises);
  try {
    const { clearBannerCache } = await import('./products.js');
    clearBannerCache();
  } catch (e) {}
}

export async function fetchBannersFromDB() {
  try {
    const snap = await getDocs(collection(db, 'banners'));
    const banners = [];
    snap.forEach(d => banners.push({ id: d.id, ...d.data() }));
    return banners;
  } catch (err) {
    console.error('Error fetching banners from DB:', err);
    return [];
  }
}

export async function deleteBannerSlot(slotNumber) {
  const slotId = `slot_${slotNumber}`;
  await setDoc(doc(db, 'banners', slotId), {
    slotId,
    slotNumber: Number(slotNumber),
    title: `Slot ${slotNumber}`,
    subtitle: '',
    image: '',
    linkTo: '',
    isEnabled: false,
    position: Number(slotNumber),
    updatedAt: new Date()
  });
  try {
    const { clearBannerCache } = await import('./products.js');
    clearBannerCache();
  } catch (e) {}
}

export async function toggleBannerVisibility(bannerId, currentStatus) {
  const isEnabled = !currentStatus;
  await updateDoc(doc(db, 'banners', bannerId), {
    isEnabled: isEnabled,
    isActive: isEnabled,
    updatedAt: new Date()
  });
  try {
    const { clearBannerCache } = await import('./products.js');
    clearBannerCache();
  } catch (e) {}
}
