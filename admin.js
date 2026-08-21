// ==========================================
// ADMIN LOGIN PROTECTION + NOTIFICATIONS
// ==========================================
function getSession() {
  try { return JSON.parse(localStorage.getItem('rj_session')); }
  catch { return null; }
}

const showSuccess = (title) => Swal.fire({
  toast: true, position: 'top-end', icon: 'success', title,
  showConfirmButton: false, timer: 2200, timerProgressBar: true
});
const showError = (text) => Swal.fire({ icon: 'error', title: 'Unable to continue', text });
const confirmDelete = async () => (await Swal.fire({
  icon: 'warning', title: 'Delete this product?', text: 'This cannot be undone.',
  showCancelButton: true, confirmButtonText: 'Delete', cancelButtonText: 'Cancel',
  confirmButtonColor: '#d9534f'
})).isConfirmed;

const session = getSession();
if (!session || session.role !== 'admin') {
  Swal.fire({ icon: 'warning', title: 'Admin login required', text: 'Please login as Admin from the main website.' })
    .then(() => { window.location.href = 'index.html'; });
}

const slugify = (value = '') => String(value).trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
const requireSupabase = () => {
  if (!window.supabaseClient) {
    throw new Error('Supabase client is not available. Check that supabase.js loads before admin.js.');
  }
  return window.supabaseClient;
};

const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/fv05tjzl/image/upload';
const CLOUDINARY_UPLOAD_PRESET = 'RJ_Ladies_Fashion';

async function uploadProductImageToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || 'Cloudinary could not upload the product image.');
  }
  return result.secure_url;
}

async function getAvailableProductSlug(name, currentProductId = '') {
  const baseSlug = slugify(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await requireSupabase()
      .from('products')
      .select('id')
      .eq('slug', candidate)
      .limit(1);
    if (error) throw error;

    const conflictingProduct = (data || []).find((product) => String(product.id) !== String(currentProductId));
    if (!conflictingProduct) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function getAvailableVariantSku(baseSku, currentVariantId = '', reservedSkus = new Set()) {
  const normalizedBaseSku = String(baseSku).trim();
  let candidate = normalizedBaseSku;
  let suffix = 2;

  while (true) {
    if (!reservedSkus.has(candidate)) {
      const { data, error } = await requireSupabase()
        .from('product_variants')
        .select('id')
        .eq('sku', candidate)
        .limit(1);
      if (error) throw error;

      const conflictingVariant = (data || []).find((variant) => String(variant.id) !== String(currentVariantId));
      if (!conflictingVariant) {
        reservedSkus.add(candidate);
        return candidate;
      }
    }

    candidate = `${normalizedBaseSku}-${suffix}`;
    suffix += 1;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('product-form');
  const tbody = document.getElementById('admin-products-tbody');
  const count = document.getElementById('total-products-count');
  const title = document.getElementById('product-form-title');
  const cancelButton = document.getElementById('cancel-edit-btn');
  const saveButton = document.getElementById('save-prod-btn');

  loadProducts();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const productId = document.getElementById('product-id').value;
    const variantData = window.adminVariants.collect();
    if (!variantData) return;

    try {
      const name = document.getElementById('prod-name').value.trim();
      const currentProduct = productId ? (window.currentProducts || []).find((item) => String(item.id) === String(productId)) : null;
      const slug = currentProduct?.name === name && currentProduct.slug
        ? currentProduct.slug
        : await getAvailableProductSlug(name, productId);
      const payload = { category_id: document.getElementById('prod-category').value, name, slug, description: '', compare_price: Number(document.getElementById('prod-price').value), fabric: '', is_featured: false, is_active: true };
      let product;
      if (productId) {
        const { data, error } = await requireSupabase().from('products').update(payload).eq('id', productId).select().single();
        if (error) throw error;
        product = data;
      } else {
        const { data, error } = await requireSupabase().from('products').insert(payload).select().single();
        if (error) throw error;
        product = data;
      }

      const existingProduct = (window.currentProducts || []).find((item) => String(item.id) === String(product.id));
      const existingVariantIds = new Set((existingProduct?.product_variants || []).map((variant) => String(variant.id)));
      const savedVariants = [];
      const reservedSkus = new Set();

      for (const [index, variant] of variantData.variants.entries()) {
        const requestedSku = variant.sku || `${slugify(name).toUpperCase()}-${index + 1}`;
        const sku = await getAvailableVariantSku(requestedSku, variant.id, reservedSkus);
        const variantPayload = {
          product_id: product.id,
          size: variant.size || 'Standard',
          color: variant.label,
          sku,
          price: Number(variant.price || payload.compare_price),
          stock: Number(variant.stock || 0),
          is_active: true
        };
        let savedVariant;
        if (variant.id) {
          const { data, error } = await requireSupabase().from('product_variants').update(variantPayload).eq('id', variant.id).eq('product_id', product.id).select().single();
          if (error) throw error;
          savedVariant = data;
          existingVariantIds.delete(String(variant.id));
        } else {
          const { data, error } = await requireSupabase().from('product_variants').insert(variantPayload).select().single();
          if (error) throw error;
          savedVariant = data;
        }
        savedVariants.push({ ...variant, id: savedVariant.id });
      }

      for (const variant of savedVariants) {
        if (variant.imageFile) await saveVariantPrimaryImage(product.id, variant.id, variant.imageFile);
      }

      if (existingVariantIds.size) {
        const { error } = await requireSupabase().from('product_variants').delete().in('id', [...existingVariantIds]);
        if (error) throw error;
      }
      showSuccess(productId ? 'Product updated successfully' : 'Product added successfully');
      resetForm();
      loadProducts();
    } catch (error) {
      console.error(error);
      showError(error.message || 'Could not connect to server');
    }
  });

  const primaryImage = (images = []) => [...images]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.sort_order || 0) - Number(b.sort_order || 0))[0] || null;

  async function saveVariantPrimaryImage(productId, variantId, file) {
    const imageUrl = await uploadProductImageToCloudinary(file);
    const { data: existingImages, error: findError } = await requireSupabase()
      .from('product_images')
      .select('id')
      .eq('product_id', productId)
      .eq('product_variant_id', variantId)
      .eq('is_primary', true)
      .order('created_at', { ascending: true })
      .limit(1);
    if (findError) throw findError;

    const imagePayload = { image_url: imageUrl, sort_order: 0, is_primary: true };
    if (existingImages?.length) {
      const { error } = await requireSupabase().from('product_images').update(imagePayload).eq('id', existingImages[0].id);
      if (error) throw error;
    } else {
      const { error } = await requireSupabase().from('product_images').insert({
        product_id: productId,
        product_variant_id: variantId,
        ...imagePayload
      });
      if (error) throw error;
    }
  }

  async function loadProducts() {
    try {
      const { data: products, error } = await requireSupabase().from('products').select('*, categories(name), product_images(*), product_variants(*, product_images(*))').order('created_at', { ascending: false });
      if (error) throw error;
      window.currentProducts = products;
      window.refreshAdminCategoryUI?.();
      window.refreshSeasonalHighlightManager?.();
      tbody.innerHTML = '';
      count.textContent = products.length;

      products.forEach((product) => {
        const variants = Array.isArray(product.product_variants) ? product.product_variants : [];
        const sizes = variants.map((variant) => variant.size).filter(Boolean).join(', ') || '-';
        const colorsHtml = variants.length
          ? variants.map((variant) => {
            return `<div class="variant-thumb variant-thumb-placeholder" title="${variant.color || 'Variant'}" aria-label="${variant.color || 'Variant'}"></div>`;
          }).join('')
          : '<span style="color:#999;">—</span>';
        const image = primaryImage(product.product_images || [])?.image_url || '';
        const categoryName = product.categories?.name || 'Uncategorized';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${image ? `<img src="${image}" width="50" style="border-radius:6px;">` : '—'}</td>
          <td>${product.id}</td><td>${product.name}</td><td>${categoryName}</td><td>₹${product.compare_price ?? '—'}</td>
          <td><div class="admin-colors-wrap">${colorsHtml}</div></td><td>${sizes}</td>
          <td><button type="button" class="btn-sm btn-edit" data-edit-id="${product.id}">Edit</button>
          <button type="button" class="btn-sm btn-delete" data-delete-id="${product.id}">Delete</button></td>`;
        tbody.appendChild(row);
      });
    } catch (error) {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="8">Unable to load products.</td></tr>';
      showError(error.message || 'Unable to load products');
    }
  }

  tbody.addEventListener('click', async (event) => {
    const editId = event.target.closest('[data-edit-id]')?.dataset.editId;
    const deleteId = event.target.closest('[data-delete-id]')?.dataset.deleteId;
    if (editId) editProduct(editId);
    if (deleteId) await deleteProduct(deleteId);
  });

  function editProduct(id) {
    const product = window.currentProducts.find((item) => String(item.id) === String(id));
    if (!product) return;
    document.getElementById('product-id').value = product.id;
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-price').value = product.compare_price || '';
    window.setAdminCategorySelect?.('prod-category', product.category_id);
    document.getElementById('prod-sizes').value = product.product_variants?.map((variant) => variant.size).filter(Boolean).join(', ') || '';
    const variants = product.product_variants?.length ? product.product_variants.map((variant) => ({ id: variant.id, label: variant.color, size: variant.size, sku: variant.sku, price: variant.price, stock: variant.stock, image: primaryImage(variant.product_images || [])?.image_url || '', swatchType: 'color', swatchValue: '#0f766e' })) : [{ label: 'Default', size: 'Standard', swatchType: 'color', swatchValue: '#0f766e' }];
    window.adminVariants.populate(variants);
    title.textContent = 'Edit Product';
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Product';
    cancelButton.style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!(await confirmDelete())) return;
    try {
      const { error } = await requireSupabase().from('products').delete().eq('id', id);
      if (error) throw error;
      if (document.getElementById('product-id').value === String(id)) resetForm();
      showSuccess('Product deleted successfully');
      loadProducts();
    } catch (error) {
      console.error(error);
      showError(error.message || 'Could not delete product');
    }
  }

  cancelButton.addEventListener('click', resetForm);
  function resetForm() {
    form.reset();
    document.getElementById('product-id').value = '';
    window.adminVariants.reset();
    title.textContent = 'Add New Product';
    saveButton.innerHTML = '<i class="fa-solid fa-plus"></i> Save Product';
    cancelButton.style.display = 'none';
  }
});

// ==========================================
// PRODUCT VARIANTS UI: ONE IMAGE PER COLOR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('variants-container');
  const addButton = document.getElementById('add-variant-btn');
  if (!container || !addButton) return;
  const template = container.querySelector('.variant-item').cloneNode(true);

  function setPreview(preview, url) {
    if (!url) {
      preview.hidden = true;
      preview.removeAttribute('src');
      return;
    }
    preview.src = url;
    preview.hidden = false;
  }

  function updateRemoveButtons() {
    const items = [...container.querySelectorAll('.variant-item')];
    items.forEach((item) => {
      item.querySelector('.remove-variant-btn').hidden = items.length === 1;
    });
  }

  function bind(item) {
    if (item.dataset.bound) return;
    item.dataset.bound = 'true';
    const type = item.querySelector('.variant-swatch-type');
    const imageGroup = item.querySelector('.swatch-image-group');
    const toggleType = () => {
      imageGroup.style.display = type.value === 'image' ? 'block' : 'none';
    };
    type.addEventListener('change', toggleType);
    item.querySelector('.remove-variant-btn').addEventListener('click', () => {
      if (container.children.length <= 1) return;
      item.remove();
      updateRemoveButtons();
    });
    item.querySelector('.variant-swatch-image').addEventListener('change', (event) => {
      const file = event.target.files[0];
      item.querySelector('.swatch-image-group .variant-file-name').textContent = file?.name || 'No swatch selected';
      item.querySelector('.variant-swatch-button-text').textContent = file || item.dataset.existingSwatch ? 'Replace Swatch' : 'Choose Swatch';
      setPreview(item.querySelector('.variant-swatch-preview'), file ? URL.createObjectURL(file) : item.dataset.existingSwatch);
    });
    item.querySelector('.variant-image').addEventListener('change', (event) => {
      const file = event.target.files[0];
      item.querySelector('.variant-image-file-name').textContent = file?.name || 'No photo selected';
      item.querySelector('.variant-image-button-text').textContent = file || item.dataset.existingImage ? 'Replace Image' : 'Choose Photo';
      setPreview(item.querySelector('.variant-image-preview'), file ? URL.createObjectURL(file) : item.dataset.existingImage);
    });
    toggleType();
  }

  function newItem(variant = {}) {
    const item = template.cloneNode(true);
    const legacyImage = Array.isArray(variant.images) ? variant.images[0] : '';
    item.dataset.variantId = variant.id || '';
    item.dataset.existingImage = variant.image || legacyImage || '';
    item.dataset.existingSwatch = variant.swatchValue || '';
    item.dataset.solidSwatch = variant.swatchType === 'color' && variant.swatchValue
      ? variant.swatchValue
      : '#0f766e';
    item.querySelector('.variant-name').value = variant.label || '';
    item.querySelector('.variant-size').value = variant.size || 'Standard';
    item.querySelector('.variant-sku').value = variant.sku || '';
    item.querySelector('.variant-price').value = variant.price ?? '';
    item.querySelector('.variant-stock').value = variant.stock ?? 0;
    item.querySelector('.variant-swatch-type').value = variant.swatchType || 'color';
    item.querySelector('.variant-image').value = '';
    item.querySelector('.variant-swatch-image').value = '';
    const hasImage = Boolean(item.dataset.existingImage);
    const hasSwatch = variant.swatchType === 'image' && Boolean(item.dataset.existingSwatch);
    item.querySelector('.variant-image-file-name').textContent = hasImage ? 'Current image loaded' : 'No photo selected';
    item.querySelector('.variant-image-button-text').textContent = hasImage ? 'Replace Image' : 'Choose Photo';
    item.querySelector('.swatch-image-group .variant-file-name').textContent = hasSwatch ? 'Current swatch loaded' : 'No swatch selected';
    item.querySelector('.variant-swatch-button-text').textContent = hasSwatch ? 'Replace Swatch' : 'Choose Swatch';
    setPreview(item.querySelector('.variant-image-preview'), item.dataset.existingImage);
    setPreview(item.querySelector('.variant-swatch-preview'), hasSwatch ? item.dataset.existingSwatch : '');
    bind(item);
    return item;
  }

  function reset() {
    container.innerHTML = '';
    container.appendChild(newItem());
    updateRemoveButtons();
  }
  function populate(variants) {
    container.innerHTML = '';
    variants.forEach((variant) => container.appendChild(newItem(variant)));
    updateRemoveButtons();
  }
  function collect() {
    const variants = [];
    const files = [];
    for (const [index, item] of [...container.querySelectorAll('.variant-item')].entries()) {
      const label = item.querySelector('.variant-name').value.trim();
      const swatchType = item.querySelector('.variant-swatch-type').value;
      const imageFile = item.querySelector('.variant-image').files[0];
      const existingImage = item.dataset.existingImage || '';
      if (!label) {
        showError('Each variant needs a color name.');
        return null;
      }
      const swatchFile = item.querySelector('.variant-swatch-image').files[0];
      const existingSwatch = item.dataset.existingSwatch || '';
      if (swatchType === 'image' && !swatchFile && !existingSwatch) {
        showError('Please choose a swatch image for each printed or mixed color.');
        return null;
      }
      variants.push({
        id: item.dataset.variantId || '',
        label,
        size: item.querySelector('.variant-size').value.trim() || 'Standard',
        sku: item.querySelector('.variant-sku').value.trim(),
        price: item.querySelector('.variant-price').value,
        stock: item.querySelector('.variant-stock').value,
        swatchType,
        swatchValue: swatchType === 'color' ? item.dataset.solidSwatch : existingSwatch,
        image: existingImage,
        imageFile
      });
      if (imageFile) files.push({ field: `variant_image_${index}`, file: imageFile });
      if (swatchFile) files.push({ field: `variant_swatch_${index}`, file: swatchFile });
    }
    return { variants, files };
  }

  addButton.addEventListener('click', () => {
    container.appendChild(newItem());
    updateRemoveButtons();
  });
  reset();
  window.adminVariants = { collect, populate, reset };
});

// ==========================================
// ADMIN TABS, CATEGORIES, ORDERS AND OFFERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = [...document.querySelectorAll('.tab-btn')];
  const tabSections = [...document.querySelectorAll('.admin-section')];
  const categoryForm = document.getElementById('category-form');
  const categoryName = document.getElementById('category-name');
  const categoryBody = document.getElementById('admin-categories-tbody');
  const productCategory = document.getElementById('prod-category');
  const offerCategory = document.getElementById('offer-category');
  const ordersBody = document.getElementById('admin-orders-tbody');
  const couponsBody = document.getElementById('admin-coupons-tbody');
  const offersBody = document.getElementById('admin-offers-tbody');
  let categories = [];

  const readLocal = (key, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  };
  const saveLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const confirmAction = async (title, text, confirmButtonText = 'Delete') => (await Swal.fire({
    icon: 'warning', title, text, showCancelButton: true, confirmButtonText,
    cancelButtonText: 'Cancel', confirmButtonColor: '#d9534f'
  })).isConfirmed;

  function openTab(tabId) {
    const section = document.getElementById(tabId);
    if (!section) return;
    tabSections.forEach((item) => item.classList.toggle('active', item.id === tabId));
    tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tabId));
    localStorage.setItem('rj_admin_active_tab', tabId);
    if (tabId === 'dashboard-tab') loadAdminDashboard();
  }

  tabButtons.forEach((button) => button.addEventListener('click', () => openTab(button.dataset.tab)));

  function selectCategory(select, categoryNameToSelect) {
    if (!select) return;
    const match = [...select.options].find((option) => String(option.value).toLowerCase() === String(categoryNameToSelect || '').toLowerCase());
    if (match) select.value = match.value;
    else if (select.options.length) select.value = select.options[0].value;
  }

  function renderCategoryOptions() {
    [productCategory, offerCategory].forEach((select) => {
      if (!select) return;
      const selected = select.dataset.pendingCategory || select.value;
      const useCategoryId = select === productCategory;
      select.innerHTML = categories.map((category) => `<option value="${escapeHtml(useCategoryId ? category.id : category.name)}">${escapeHtml(category.name)}</option>`).join('');
      selectCategory(select, selected);
      delete select.dataset.pendingCategory;
    });
  }

  function productCount(category) {
    return (window.currentProducts || []).filter((product) => String(product.category_id) === String(category.id)).length;
  }

  function renderCategories() {
    if (!categoryBody) return;
    if (!categories.length) {
      categoryBody.innerHTML = '<tr><td colspan="3">No categories yet.</td></tr>';
      return;
    }
    categoryBody.innerHTML = categories.map((category) => `
      <tr><td>${escapeHtml(category.name)}</td><td>${productCount(category)} Product${productCount(category) === 1 ? '' : 's'}</td>
      <td><button type="button" class="btn-sm btn-delete" data-category-delete="${escapeHtml(category.id)}"><i class="fa-solid fa-trash"></i> Delete</button></td></tr>`).join('');
  }

  async function loadCategories() {
    try {
      const { data, error } = await requireSupabase().from('categories').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      categories = data || [];
      renderCategoryOptions();
      renderCategories();
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to load categories.');
    }
  }

  window.setAdminCategorySelect = (selectId, value) => {
    const select = document.getElementById(selectId);
    if (!select) return;
    if (!select.options.length) select.dataset.pendingCategory = value;
    else selectCategory(select, value);
  };
  window.refreshAdminCategoryUI = () => {
    renderCategories();
    renderCategoryOptions();
  };

  categoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = categoryName.value.trim();
    if (!name) return showError('Please enter a category name.');
    try {
      const { error } = await requireSupabase().from('categories').insert({ name, slug: slugify(name), image_url: null, is_active: true });
      if (error) throw error;
      categoryForm.reset();
      await loadCategories();
      showSuccess('Category added successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to add category.');
    }
  });

  categoryBody?.addEventListener('click', async (event) => {
    const categoryId = event.target.closest('[data-category-delete]')?.dataset.categoryDelete;
    if (!categoryId) return;
    const category = categories.find((item) => String(item.id) === String(categoryId));
    if (!category || !(await confirmAction(`Delete category “${category.name}”?`, 'This cannot be undone.'))) return;
    try {
      const { error } = await requireSupabase().from('categories').delete().eq('id', categoryId);
      if (error) throw error;
      await loadCategories();
      showSuccess('Category deleted successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to delete category.');
    }
  });

  const statusOptions = [
    { value: 'pending', label: 'Pending', badgeClass: 'pending' },
    { value: 'confirmed', label: 'Order Confirmed', badgeClass: 'confirmed' },
    { value: 'shipped', label: 'On The Way', badgeClass: 'ontheway' },
    { value: 'delivered', label: 'Delivered', badgeClass: 'delivered' }
  ];

  const getStatusInfo = (rawStatus) => {
    const s = String(rawStatus || 'pending').toLowerCase();
    if (s === 'confirmed' || s === 'order confirmed') return { value: 'confirmed', label: 'Order Confirmed', badgeClass: 'confirmed' };
    if (s === 'shipped' || s === 'on the way') return { value: 'shipped', label: 'On The Way', badgeClass: 'ontheway' };
    if (s === 'delivered') return { value: 'delivered', label: 'Delivered', badgeClass: 'delivered' };
    if (s === 'cancelled') return { value: 'cancelled', label: 'Cancelled', badgeClass: 'pending' };
    return { value: 'pending', label: 'Pending', badgeClass: 'pending' };
  };

  const formatDashMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  let dashboardOrdersCache = [];
  let dashboardSalesPeriod = 'today';

  function countStatus(orders, matcher) {
    return orders.filter((order) => matcher(getStatusInfo(order.status).value)).length;
  }

  function snapshotQty(order) {
    const items = Array.isArray(order.order_snapshot?.items) ? order.order_snapshot.items : [];
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }

  function orderTimestamp(order) {
    const raw = order.placed_at || order.created_at;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfLocalDay(date) {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  function startOfLocalWeek(date) {
    const value = startOfLocalDay(date);
    const weekday = value.getDay();
    value.setDate(value.getDate() - (weekday === 0 ? 6 : weekday - 1));
    return value;
  }

  function getSalesPeriodRange(period, now = new Date()) {
    if (period === 'today') {
      const start = startOfLocalDay(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    if (period === 'week') {
      const start = startOfLocalWeek(now);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    if (period === 'sixmonths') {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start, end };
  }

  function ordersForSalesPeriod(orders, period) {
    const { start, end } = getSalesPeriodRange(period);
    return orders.filter((order) => {
      const date = orderTimestamp(order);
      return date && date >= start && date < end;
    });
  }

  function buildSalesBuckets(period, now = new Date()) {
    if (period === 'today') {
      return Array.from({ length: 24 }, (_, hour) => {
        const start = startOfLocalDay(now);
        start.setHours(hour);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const label = start.toLocaleTimeString('en-IN', { hour: 'numeric' });
        return { key: String(hour), label, start, end, total: 0 };
      });
    }
    if (period === 'week') {
      const weekStart = startOfLocalWeek(now);
      return Array.from({ length: 7 }, (_, index) => {
        const start = new Date(weekStart);
        start.setDate(weekStart.getDate() + index);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return {
          key: start.toDateString(),
          label: start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
          start,
          end,
          total: 0
        };
      });
    }
    if (period === 'month') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, index) => {
        const start = new Date(now.getFullYear(), now.getMonth(), index + 1);
        const end = new Date(now.getFullYear(), now.getMonth(), index + 2);
        return { key: String(index + 1), label: String(index + 1), start, end, total: 0 };
      });
    }
    if (period === 'sixmonths') {
      return Array.from({ length: 6 }, (_, index) => {
        const start = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        return {
          key: `${start.getFullYear()}-${start.getMonth()}`,
          label: start.toLocaleDateString('en-IN', { month: 'short' }),
          start,
          end,
          total: 0
        };
      });
    }
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(now.getFullYear(), index, 1);
      const end = new Date(now.getFullYear(), index + 1, 1);
      return {
        key: String(index),
        label: start.toLocaleDateString('en-IN', { month: 'short' }),
        start,
        end,
        total: 0
      };
    });
  }

  function fillSalesBuckets(orders, buckets) {
    orders.forEach((order) => {
      const date = orderTimestamp(order);
      if (!date) return;
      const bucket = buckets.find((item) => date >= item.start && date < item.end);
      if (!bucket) return;
      bucket.total += Number(order.total_amount) || 0;
    });
    return buckets;
  }

  function shouldShowBucketLabel(period, index, total) {
    if (period === 'today') return index % 3 === 0 || index === total - 1;
    if (period === 'month') return index === 0 || (index + 1) % 5 === 0 || index === total - 1;
    return true;
  }

  function renderSalesTrendChart(buckets, period) {
    const chart = document.getElementById('dashboard-chart');
    if (!chart) return;
    const max = Math.max(...buckets.map((bucket) => bucket.total), 0);
    if (!buckets.length) {
      chart.innerHTML = '<p class="dashboard-chart-empty">No sales data for this period.</p>';
      return;
    }
    const width = 720;
    const height = 240;
    const pad = { top: 18, right: 16, bottom: 38, left: 52 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const points = buckets.map((bucket, index) => {
      const x = pad.left + (buckets.length === 1 ? innerWidth / 2 : (index / (buckets.length - 1)) * innerWidth);
      const y = pad.top + innerHeight - (max ? (bucket.total / max) * innerHeight : 0);
      return { x, y, ...bucket };
    });
    const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const areaPath = `M${points[0].x.toFixed(1)},${(pad.top + innerHeight).toFixed(1)} ${points.map((point) => `L${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')} L${points[points.length - 1].x.toFixed(1)},${(pad.top + innerHeight).toFixed(1)} Z`;
    const yTicks = [0, 0.5, 1].map((ratio) => {
      const value = max * ratio;
      const y = pad.top + innerHeight - ratio * innerHeight;
      return `<text x="8" y="${y + 4}" fill="#8a7d76" font-size="11">${escapeHtml(formatDashMoney(value))}</text>
        <line x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}" stroke="#f3d7df" stroke-width="1" />`;
    }).join('');
    const labels = points.map((point, index) => (
      shouldShowBucketLabel(period, index, points.length)
        ? `<text x="${point.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="#8a7d76" font-size="11">${escapeHtml(point.label)}</text>`
        : ''
    )).join('');
    const dots = points.map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" fill="#d96b8a">
      <title>${escapeHtml(point.label)}: ${escapeHtml(formatDashMoney(point.total))}</title>
    </circle>`).join('');
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Sales trend">
      <defs>
        <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d96b8a" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#d96b8a" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${yTicks}
      <path d="${areaPath}" fill="url(#salesAreaFill)"></path>
      <path d="${linePath}" fill="none" stroke="#d96b8a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${labels}
    </svg>`;
  }

  function renderSalesOverview(orders, period) {
    const periodOrders = ordersForSalesPeriod(orders, period);
    const totalSales = periodOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    const orderCount = periodOrders.length;
    const average = orderCount ? totalSales / orderCount : 0;
    const totalEl = document.getElementById('sales-period-total');
    const countEl = document.getElementById('sales-period-count');
    const averageEl = document.getElementById('sales-period-average');
    if (totalEl) totalEl.textContent = formatDashMoney(totalSales);
    if (countEl) countEl.textContent = String(orderCount);
    if (averageEl) averageEl.textContent = formatDashMoney(average);
    renderSalesTrendChart(fillSalesBuckets(periodOrders, buildSalesBuckets(period)), period);
  }

  function bindSalesPeriodControl() {
    const control = document.getElementById('sales-period-control');
    if (!control || control.dataset.bound === 'true') return;
    control.dataset.bound = 'true';
    control.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sales-period]');
      if (!button) return;
      dashboardSalesPeriod = button.dataset.salesPeriod;
      control.querySelectorAll('[data-sales-period]').forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });
      renderSalesOverview(dashboardOrdersCache, dashboardSalesPeriod);
    });
  }

  function renderDashboardChart(orders) {
    dashboardOrdersCache = orders || [];
    bindSalesPeriodControl();
    renderSalesOverview(dashboardOrdersCache, dashboardSalesPeriod);
  }

  async function loadAdminDashboard() {
    const statsEl = document.getElementById('dashboard-stats');
    const recentEl = document.getElementById('dashboard-recent-orders');
    const updatedEl = document.getElementById('dashboard-updated');
    if (!statsEl || !recentEl) return;
    try {
      const [ordersResult, productsResult] = await Promise.all([
        requireSupabase().from('orders').select('id, order_number, notes, phone, status, total_amount, placed_at, created_at, order_snapshot').order('created_at', { ascending: false }),
        requireSupabase().from('products').select('id, is_active, product_variants(id, stock, is_active)')
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;

      const orders = ordersResult.data || [];
      const products = productsResult.data || [];
      const totalSales = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      const productsSold = orders.reduce((sum, order) => sum + snapshotQty(order), 0);
      const activeProducts = products.filter((product) => product.is_active !== false).length;
      const attentionProducts = products.filter((product) => {
        const variants = Array.isArray(product.product_variants) ? product.product_variants : [];
        if (!variants.length) return true;
        return variants.some((variant) => Number(variant.stock || 0) <= 5);
      }).length;

      const cards = [
        { icon: 'fa-indian-rupee-sign', label: 'Total Sales', value: formatDashMoney(totalSales) },
        { icon: 'fa-bag-shopping', label: 'Total Orders', value: orders.length },
        { icon: 'fa-clock', label: 'Pending Orders', value: countStatus(orders, (status) => status === 'pending') },
        { icon: 'fa-circle-check', label: 'Confirmed Orders', value: countStatus(orders, (status) => status === 'confirmed') },
        { icon: 'fa-truck', label: 'Orders On The Way', value: countStatus(orders, (status) => status === 'shipped') },
        { icon: 'fa-box-open', label: 'Delivered Orders', value: countStatus(orders, (status) => status === 'delivered') },
        { icon: 'fa-shirt', label: 'Total Products', value: products.length },
        { icon: 'fa-toggle-on', label: 'Active Products', value: activeProducts },
        { icon: 'fa-boxes-stacked', label: 'Out-of-Stock / Low-Stock', value: attentionProducts },
        { icon: 'fa-tags', label: 'Products Sold', value: productsSold }
      ];
      statsEl.innerHTML = cards.map((card) => `
        <article class="dash-stat">
          <i class="fa-solid ${card.icon}"></i>
          <span>${card.label}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>`).join('');

      const recent = orders.slice(0, 8);
      recentEl.innerHTML = recent.length ? recent.map((order) => {
        const status = getStatusInfo(order.status);
        const dateStr = order.placed_at ? new Date(order.placed_at).toLocaleDateString() : (order.created_at ? new Date(order.created_at).toLocaleDateString() : '—');
        return `<tr>
          <td>${escapeHtml(order.order_number || order.id)}</td>
          <td>${escapeHtml(order.notes || 'Customer')}</td>
          <td>${escapeHtml(formatDashMoney(order.total_amount))}</td>
          <td><span class="status-badge status-${status.badgeClass}">${escapeHtml(status.label)}</span></td>
          <td>${escapeHtml(dateStr)}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="5">No WhatsApp orders yet.</td></tr>';

      renderDashboardChart(orders);
      if (updatedEl) updatedEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
      statsEl.innerHTML = '<p class="dashboard-empty">Unable to load dashboard statistics.</p>';
      recentEl.innerHTML = '<tr><td colspan="5">Unable to load recent orders.</td></tr>';
    }
  }

  let loadedOrders = [];
  let ordersSearchQuery = '';

  function orderMatchesSearch(order, query) {
    const q = String(query || '').trim();
    if (!q) return true;
    const orderNo = String(order.order_number || '').toLowerCase();
    if (orderNo.includes(q.toLowerCase())) return true;
    const queryDigits = q.replace(/\D/g, '');
    if (queryDigits) {
      const phoneDigits = String(order.phone || '').replace(/\D/g, '');
      if (phoneDigits.includes(queryDigits)) return true;
    }
    return false;
  }

  function paintOrdersTable(orders) {
    if (!ordersBody) return;
    if (!orders.length) {
      const emptyMessage = ordersSearchQuery.trim()
        ? 'No matching orders found.'
        : 'No WhatsApp orders yet.';
      ordersBody.innerHTML = `<tr><td colspan="8">${emptyMessage}</td></tr>`;
      return;
    }
    ordersBody.innerHTML = orders.map((order) => {
      const items = Array.isArray(order.order_snapshot?.items) ? order.order_snapshot.items: [];
      const itemsSummary = items.map(i => {
      const variant = [i.color, i.size].filter(Boolean).join(', '); return `${escapeHtml(i.name || 'Product')}${variant ? ` (${escapeHtml(variant)})` : ''} × ${escapeHtml(i.qty ?? 1)}`; }).join(', ') || 'Order details unavailable';
      const dateStr = order.placed_at ? new Date(order.placed_at).toLocaleDateString() : (order.created_at ? new Date(order.created_at).toLocaleDateString() : '—');
      const currentStatusInfo = getStatusInfo(order.status);
      return `
        <tr>
          <td>${escapeHtml(order.order_number || order.id)}</td>
          <td>${escapeHtml(order.notes || 'Customer')}</td>
          <td>${escapeHtml(order.phone || '—')}</td>
          <td>${itemsSummary}</td>
          <td>₹${escapeHtml(order.total_amount)}</td>
          <td><span class="status-badge status-${currentStatusInfo.badgeClass}">${escapeHtml(currentStatusInfo.label)}</span></td>
          <td>
            <select class="form-control" data-order-status="${escapeHtml(order.id)}">
              ${statusOptions.map((opt) => `<option value="${opt.value}" ${opt.value === currentStatusInfo.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
          </td>
          <td>
            <div class="action-btns">
              <button class="btn-sm btn-whatsapp" data-order-whatsapp="${escapeHtml(order.id)}"><i class="fa-brands fa-whatsapp"></i> Notify</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  async function renderOrders() {
    if (!ordersBody) return;
    try {
      if (!window.supabaseClient) throw new Error("Supabase client not available.");
      const { data: orders, error } = await requireSupabase()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      loadedOrders = orders || [];
      paintOrdersTable(loadedOrders.filter((order) => orderMatchesSearch(order, ordersSearchQuery)));
    } catch (err) {
      console.error("Failed to load orders from Supabase:", err);
      ordersBody.innerHTML = '<tr><td colspan="8" style="color:red;">Failed to load orders from Supabase.</td></tr>';
    }
  }

  document.getElementById('orders-search-input')?.addEventListener('input', (event) => {
    ordersSearchQuery = event.target.value;
    paintOrdersTable(loadedOrders.filter((order) => orderMatchesSearch(order, ordersSearchQuery)));
  });

  ordersBody?.addEventListener('change', async (event) => {
    const id = event.target.dataset.orderStatus;
    if (!id) return;
    const newStatus = event.target.value;
    try {
      const { error } = await requireSupabase()
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      showSuccess('Order status updated');
      renderOrders();
    } catch (err) {
      console.error("Failed to update order status:", err);
      showError("Could not update order status.");
    }
  });

  ordersBody?.addEventListener('click', async (event) => {
    const id = event.target.closest('[data-order-whatsapp]')?.dataset.orderWhatsapp;
    if (!id) return;
    try {
      const { data: order, error } = await requireSupabase()
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !order) throw error || new Error("Order not found");
      const phone = String(order.phone || '').replace(/\D/g, '');
      if (!phone) return showError('This order does not have a customer phone number.');
      const message = `Hello ${order.notes || 'Customer'}, your RJ Ladies Fashion order ${order.order_number || order.id} is now: ${order.status || 'Pending'}.`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    } catch (err) {
      console.error("Failed to fetch order for notification:", err);
    }
  });

  const importOverlay = document.getElementById('whatsapp-import-overlay');
  const importTextarea = document.getElementById('whatsapp-import-text');

  function getImportErrorEl() {
    let el = document.getElementById('whatsapp-import-error');
    if (el || !importOverlay) return el;
    const card = importOverlay.querySelector('.whatsapp-import-card');
    const actions = importOverlay.querySelector('.whatsapp-import-actions');
    if (!card) return null;
    el = document.createElement('p');
    el.id = 'whatsapp-import-error';
    el.setAttribute('role', 'alert');
    el.style.color = '#8c3d3d';
    el.style.fontSize = '14px';
    el.style.margin = '12px 0 0';
    el.hidden = true;
    card.insertBefore(el, actions || null);
    return el;
  }

  function showImporterError(message) {
    const el = getImportErrorEl();
    if (!el) return showError(message);
    el.textContent = message || '';
    el.hidden = !message;
  }

  function clearImporterError() {
    const el = document.getElementById('whatsapp-import-error');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  function importerSwalOptions(options) {
    return {
      ...options,
      target: importOverlay || undefined,
      heightAuto: false
    };
  }

  function openWhatsAppImportModal() {
    if (!importOverlay) return;
    if (importTextarea) importTextarea.value = '';
    clearImporterError();
    importOverlay.hidden = false;
    importOverlay.classList.add('is-open');
    importTextarea?.focus();
  }

  function closeWhatsAppImportModal() {
    if (!importOverlay) return;
    importOverlay.classList.remove('is-open');
    importOverlay.hidden = true;
    clearImporterError();
  }

  function normalizeCompareText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function normalizeMoneyValue(value) {
    const amount = Number(String(value ?? '').replace(/[₹,\s]/g, ''));
    return Number.isFinite(amount) ? amount : null;
  }

  function normalizePhoneDigits(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    return digits;
  }

  function displayValue(value) {
    if (value == null || value === '') return '(none)';
    return String(value);
  }

  function isBlankCoupon(value) {
    const text = normalizeCompareText(value);
    return !text || text === 'null' || text === 'none' || text === '(none)' || text === 'n/a';
  }

  function parseWhatsAppOrderMessage(raw) {
    const text = String(raw || '').replace(/\r\n/g, '\n');
    const labeled = (label) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = text.match(new RegExp('(?:\\*)?' + escaped + ':\\*?\\s*(.+)', 'i'));
      return match ? match[1].replace(/^[*_]+|[*_]+$/g, '').trim() : '';
    };
    const addressLine = (prefix) => {
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = text.match(new RegExp('^' + escaped + '\\s*(.+)$', 'im'));
      return match ? match[1].trim() : '';
    };
    const itemsBlock = text.match(/\*?Items:?\*?\s*([\s\S]*?)\*?Subtotal:/i);
    const items = [];
    if (itemsBlock) {
      const itemPattern = /(?:[•\u2022\-*]\s*)?(.+?)\s+[—–-]\s*(.+?),\s*(.+?)\s+[×xX]\s*(\d+)\s*:\s*₹?\s*([\d,]+)/g;
      let match;
      while ((match = itemPattern.exec(itemsBlock[1]))) {
        const qty = Number(match[4]);
        const lineTotal = Number(String(match[5]).replace(/,/g, ''));
        items.push({
          name: match[1].trim(),
          color: match[2].trim(),
          size: match[3].trim(),
          qty,
          lineTotal,
          price: qty ? lineTotal / qty : lineTotal
        });
      }
    }
    const extractedRef = labeled('Order Ref').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\u2010-\u2015\u2212]/g, '-');
    const compactRef = extractedRef.toUpperCase().match(/RJ-\d+/);
    const discountLabel = labeled('Discount');
    const couponLabel = labeled('Coupon');
    return {
      order_ref: compactRef ? compactRef[0] : extractedRef,
      customer_name: labeled('Customer'),
      whatsapp_number: labeled('WhatsApp'),
      house_flat: addressLine('House/Flat:'),
      street_area: addressLine('Street/Area:'),
      city: addressLine('City:'),
      district: addressLine('District:'),
      state: addressLine('State:'),
      pincode: addressLine('Pincode:'),
      items,
      subtotal: normalizeMoneyValue(labeled('Subtotal')),
      coupon_code: isBlankCoupon(couponLabel) ? '' : couponLabel,
      has_coupon_line: Boolean(couponLabel),
      discount: discountLabel ? normalizeMoneyValue(discountLabel) : 0,
      shipping: labeled('Shipping'),
      final_total: normalizeMoneyValue(labeled('Final Total'))
    };
  }

  function itemMatchKey(item) {
    return [item?.name, item?.color, item?.size].map(normalizeCompareText).join('|');
  }

  function readOrderSnapshot(request) {
    let snapshot = request.order_snapshot;
    if (typeof snapshot === 'string') {
      try { snapshot = JSON.parse(snapshot); } catch { snapshot = {}; }
    }
    return snapshot && typeof snapshot === 'object' ? snapshot : {};
  }

  function compareWhatsAppOrder(parsed, request) {
    const snapshot = readOrderSnapshot(request);
    const customer = snapshot.customer || {};
    const totals = snapshot.totals || {};
    const coupon = snapshot.coupon && typeof snapshot.coupon === 'object' ? snapshot.coupon : {};
    const expectedItems = Array.isArray(snapshot.items) ? snapshot.items : [];
    const mismatches = [];
    const addMismatch = (field, expected, actual) => {
      mismatches.push({ field, expected, actual });
    };

    const expectedCoupon = isBlankCoupon(request.coupon_code) && isBlankCoupon(coupon.code)
      ? ''
      : String(request.coupon_code || coupon.code || '');
    const expectedDiscount = Number(request.discount_amount ?? totals.discount_amount ?? totals.discount ?? 0) || 0;
    const shippingAmountNull = request.shipping_amount == null || request.shipping_amount === '';
    const expectedShipping = shippingAmountNull
      ? 'To be confirmed'
      : String(totals.shipping || request.shipping_amount);

    const expected = {
      customer_name: request.customer_name || customer.customer_name || '',
      whatsapp_number: request.whatsapp_number || customer.whatsapp_number || '',
      house_flat: request.house_flat || customer.house_flat || '',
      street_area: request.street_area || customer.street_area || '',
      city: request.city || customer.city || '',
      district: request.district || customer.district || '',
      state: request.state || customer.state || '',
      pincode: request.pincode || customer.pincode || '',
      subtotal: request.subtotal ?? totals.subtotal ?? 0,
      coupon_code: expectedCoupon,
      discount: expectedDiscount,
      shipping: expectedShipping,
      final_total: request.final_total ?? totals.final_total ?? 0
    };

    if (normalizeCompareText(parsed.customer_name) !== normalizeCompareText(expected.customer_name)) {
      addMismatch('Customer name', expected.customer_name, parsed.customer_name);
    }
    if (normalizePhoneDigits(parsed.whatsapp_number) !== normalizePhoneDigits(expected.whatsapp_number)) {
      addMismatch('WhatsApp number', expected.whatsapp_number, parsed.whatsapp_number);
    }
    [
      ['House/Flat', 'house_flat'],
      ['Street/Area', 'street_area'],
      ['City', 'city'],
      ['District', 'district'],
      ['State', 'state'],
      ['Pincode', 'pincode']
    ].forEach(([label, key]) => {
      if (normalizeCompareText(parsed[key]) !== normalizeCompareText(expected[key])) {
        addMismatch(label, expected[key], parsed[key]);
      }
    });

    if (expectedItems.length !== parsed.items.length) {
      addMismatch('Products', `${expectedItems.length} item(s)`, `${parsed.items.length} item(s)`);
    }

    const remainingParsed = [...parsed.items];
    expectedItems.forEach((expectedItem, index) => {
      const key = itemMatchKey(expectedItem);
      const parsedIndex = remainingParsed.findIndex((item) => itemMatchKey(item) === key);
      const parsedItem = parsedIndex >= 0 ? remainingParsed.splice(parsedIndex, 1)[0] : null;
      const prefix = expectedItem.name || `Item ${index + 1}`;
      if (!parsedItem) {
        addMismatch(`${prefix} — product`, `${expectedItem.name || ''} (${expectedItem.color || ''}, ${expectedItem.size || ''})`, '(missing in WhatsApp message)');
        return;
      }
      if (Number(parsedItem.qty) !== Number(expectedItem.qty)) {
        addMismatch(`${prefix} — quantity`, expectedItem.qty, parsedItem.qty);
      }
      const expectedUnit = Number(expectedItem.price);
      const expectedLine = expectedItem.lineTotal ?? (expectedUnit * Number(expectedItem.qty || 0));
      if (normalizeMoneyValue(parsedItem.price) !== normalizeMoneyValue(expectedUnit) && Number.isFinite(expectedUnit)) {
        addMismatch(`${prefix} — price`, expectedUnit, parsedItem.price);
      }
      if (normalizeMoneyValue(parsedItem.lineTotal) !== normalizeMoneyValue(expectedLine)) {
        addMismatch(`${prefix} — line total`, expectedLine, parsedItem.lineTotal);
      }
    });
    remainingParsed.forEach((extra) => {
      addMismatch('Extra WhatsApp product', '(not in saved request)', `${extra.name} (${extra.color}, ${extra.size}) × ${extra.qty}`);
    });

    if (normalizeMoneyValue(parsed.subtotal) !== normalizeMoneyValue(expected.subtotal)) {
      addMismatch('Subtotal', expected.subtotal, parsed.subtotal);
    }

    const parsedCoupon = parsed.has_coupon_line ? parsed.coupon_code : '';
    if (!(isBlankCoupon(parsedCoupon) && isBlankCoupon(expected.coupon_code))
      && normalizeCompareText(parsedCoupon) !== normalizeCompareText(expected.coupon_code)) {
      addMismatch('Coupon', expected.coupon_code, parsedCoupon);
    }
    if (normalizeMoneyValue(parsed.discount ?? 0) !== normalizeMoneyValue(expected.discount)) {
      addMismatch('Discount', expected.discount, parsed.discount);
    }

    const parsedShipping = normalizeCompareText(parsed.shipping);
    const shippingOk = shippingAmountNull
      ? (!parsedShipping || parsedShipping === 'to be confirmed')
      : parsedShipping === normalizeCompareText(expected.shipping);
    if (!shippingOk) {
      addMismatch('Shipping', expected.shipping, parsed.shipping);
    }
    if (normalizeMoneyValue(parsed.final_total) !== normalizeMoneyValue(expected.final_total)) {
      addMismatch('Final total', expected.final_total, parsed.final_total);
    }

    return { expected, expectedItems, mismatches };
  }

  function formatMismatchHtml(mismatches) {
    return `<p>The pasted WhatsApp message does not match the saved pending request. Nothing was imported.</p>
      <ul style="text-align:left; margin:12px 0 0; padding-left:18px; max-height:320px; overflow:auto;">
        ${mismatches.map((item) => `<li style="margin-bottom:8px;"><strong>${escapeHtml(item.field)}</strong><br>
          Expected: ${escapeHtml(displayValue(item.expected))}<br>
          WhatsApp: ${escapeHtml(displayValue(item.actual))}</li>`).join('')}
      </ul>`;
  }

  function formatReviewHtml(request, expectedItems) {
    const itemsHtml = expectedItems.length
      ? expectedItems.map((item) => `${escapeHtml(item.name || 'Product')} (${escapeHtml(item.color || '')}, ${escapeHtml(item.size || '')}) × ${escapeHtml(item.qty ?? 1)}: ₹${escapeHtml(item.lineTotal ?? item.price ?? '')}`).join('<br>')
      : 'Order details unavailable';
    return `<div style="text-align:left; font-size:14px; line-height:1.5;">
      <p><strong>Order Ref:</strong> ${escapeHtml(request.order_ref)}</p>
      <p><strong>Customer:</strong> ${escapeHtml(request.customer_name)}</p>
      <p><strong>WhatsApp:</strong> ${escapeHtml(request.whatsapp_number)}</p>
      <p><strong>Address:</strong><br>
        ${escapeHtml(request.house_flat)}, ${escapeHtml(request.street_area)}<br>
        ${escapeHtml(request.city)}, ${escapeHtml(request.district)}, ${escapeHtml(request.state)} ${escapeHtml(request.pincode)}</p>
      <p><strong>Items:</strong><br>${itemsHtml}</p>
      <p><strong>Subtotal:</strong> ₹${escapeHtml(request.subtotal)}<br>
        <strong>Coupon:</strong> ${escapeHtml(request.coupon_code || '(none)')}<br>
        <strong>Discount:</strong> ₹${escapeHtml(request.discount_amount ?? 0)}<br>
        <strong>Shipping:</strong> To be confirmed<br>
        <strong>Final Total:</strong> ₹${escapeHtml(request.final_total)}</p>
    </div>`;
  }

  async function importVerifiedWhatsAppOrder(request) {
    const orderNumber = request.order_ref;
    const { data: existing, error: existingError } = await requireSupabase()
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      throw new Error(`An order with Order Ref ${orderNumber} already exists. Duplicate import was blocked.`);
    }

    const { error: insertError } = await requireSupabase()
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'pending',
        notes: request.customer_name,
        phone: request.whatsapp_number,
        subtotal: request.subtotal,
        total_amount: request.final_total,
        placed_at: request.created_at || new Date().toISOString(),
        order_snapshot: request.order_snapshot
      });
    if (insertError) throw insertError;

    let deleteQuery = requireSupabase()
      .from('whatsapp_order_requests')
      .delete()
      .eq('order_ref', orderNumber)
      .eq('status', 'pending_whatsapp');
    if (request.id) deleteQuery = deleteQuery.eq('id', request.id);
    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;
  }

  async function reviewWhatsAppImport() {
    clearImporterError();
    const pasted = String(importTextarea?.value || '').trim();
    if (!pasted) return showImporterError('Please paste the customer’s WhatsApp order message.');

    const parsed = parseWhatsAppOrderMessage(pasted);
    const orderRef = String(parsed.order_ref || '').trim().toUpperCase();
    parsed.order_ref = orderRef;
    if (!orderRef) return showImporterError('Could not find an Order Ref in the pasted message.');

    try {
      const { data: request, error } = await requireSupabase()
        .from('whatsapp_order_requests')
        .select('*')
        .eq('order_ref', orderRef)
        .eq('status', 'pending_whatsapp')
        .maybeSingle();
      if (error) throw error;
      if (!request) {
        const { data: existingOrder, error: existingOrderError } = await requireSupabase()
          .from('orders')
          .select('id')
          .eq('order_number', orderRef)
          .maybeSingle();
        if (existingOrderError) throw existingOrderError;
        if (existingOrder) {
          return showImporterError(`Order ${orderRef} already exists / has already been imported.`);
        }
        return showImporterError(`No order found for Order Ref ${orderRef}.`);
      }

      const { expectedItems, mismatches } = compareWhatsAppOrder(parsed, request);
      if (mismatches.length) {
        await Swal.fire(importerSwalOptions({
          icon: 'warning',
          title: 'WhatsApp message does not match',
          html: formatMismatchHtml(mismatches),
          confirmButtonColor: '#8c3d3d',
          width: 640
        }));
        return;
      }

      const confirmed = (await Swal.fire(importerSwalOptions({
        icon: 'question',
        title: 'Confirm & Import',
        html: formatReviewHtml(request, expectedItems),
        showCancelButton: true,
        confirmButtonText: 'Confirm & Import',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#8c3d3d',
        width: 640
      }))).isConfirmed;
      if (!confirmed) return;

      await importVerifiedWhatsAppOrder(request);
      closeWhatsAppImportModal();
      await renderOrders();
      showSuccess(`Order ${orderRef} imported`);
    } catch (err) {
      console.error('Failed to import WhatsApp order:', err);
      showImporterError(err.message || 'Unable to import this WhatsApp order.');
    }
  }

  document.getElementById('import-whatsapp-order-btn')?.addEventListener('click', openWhatsAppImportModal);
  document.getElementById('whatsapp-import-close')?.addEventListener('click', closeWhatsAppImportModal);
  document.getElementById('whatsapp-import-cancel')?.addEventListener('click', closeWhatsAppImportModal);
  importOverlay?.addEventListener('click', (event) => {
    if (event.target === importOverlay) closeWhatsAppImportModal();
  });
  document.getElementById('whatsapp-import-review')?.addEventListener('click', reviewWhatsAppImport);

  let coupons = [];

  function renderCoupons() {
    if (!couponsBody) return;
    couponsBody.innerHTML = coupons.length ? coupons.map((coupon) => `<tr><td>${escapeHtml(coupon.code)}</td><td>${escapeHtml(coupon.discount_value)}${coupon.discount_type === 'percentage' ? '% OFF' : ' OFF'}</td><td>₹${escapeHtml(coupon.minimum_order_amount ?? 0)}+</td><td>${escapeHtml(coupon.description || '—')}</td><td>${coupon.is_active ? 'Active' : 'Inactive'}</td><td><div class="action-btns"><button class="btn-sm btn-edit" data-coupon-toggle="${escapeHtml(coupon.id)}">${coupon.is_active ? 'Disable' : 'Enable'}</button><button class="btn-sm btn-delete" data-coupon-delete="${escapeHtml(coupon.id)}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6">No coupons yet.</td></tr>';
  }

  async function loadCoupons() {
    try {
      const { data, error } = await requireSupabase().from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      coupons = data || [];
      renderCoupons();
    } catch (error) {
      console.error(error);
      couponsBody.innerHTML = '<tr><td colspan="6">Unable to load coupons.</td></tr>';
      showError(error.message || 'Unable to load coupons.');
    }
  }

  document.getElementById('coupon-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    if (!code) return showError('Please enter a coupon code.');
    try {
      const { error } = await requireSupabase().from('coupons').insert({
        code,
        description: document.getElementById('coupon-desc').value.trim() || null,
        discount_type: 'percentage',
        discount_value: Number(document.getElementById('coupon-discount').value),
        minimum_order_amount: Number(document.getElementById('coupon-min-spend').value),
        maximum_discount_amount: null,
        usage_limit: null,
        starts_at: null,
        expires_at: null,
        is_active: true
      });
      if (error) throw error;
      event.target.reset();
      await loadCoupons();
      showSuccess('Coupon created successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to create coupon.');
    }
  });

  couponsBody?.addEventListener('click', async (event) => {
    const toggleId = event.target.closest('[data-coupon-toggle]')?.dataset.couponToggle;
    const deleteId = event.target.closest('[data-coupon-delete]')?.dataset.couponDelete;
    const couponId = toggleId || deleteId;
    if (!couponId) return;
    const coupon = coupons.find((item) => String(item.id) === String(couponId));
    if (!coupon) return;
    try {
      if (toggleId) {
        const { error } = await requireSupabase().from('coupons').update({ is_active: !coupon.is_active }).eq('id', couponId);
        if (error) throw error;
        await loadCoupons();
        showSuccess('Coupon updated successfully');
        return;
      }
      if (!(await confirmAction(`Delete coupon “${coupon.code}”?`, 'This cannot be undone.'))) return;
      const { error } = await requireSupabase().from('coupons').delete().eq('id', couponId);
      if (error) throw error;
      await loadCoupons();
      showSuccess('Coupon deleted successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to update coupon.');
    }
  });

  function renderOffers() {
    if (!offersBody) return;
    const offers = readLocal('rj_offers');
    offersBody.innerHTML = offers.length ? offers.map((offer) => `<tr><td>${escapeHtml(offer.category)}</td><td>${escapeHtml(offer.discount)}% OFF</td><td>${escapeHtml(offer.bannerText)}</td><td>${offer.active ? 'Active' : 'Inactive'}</td><td><div class="action-btns"><button class="btn-sm btn-edit" data-offer-toggle="${escapeHtml(offer.category)}">${offer.active ? 'Disable' : 'Enable'}</button><button class="btn-sm btn-delete" data-offer-delete="${escapeHtml(offer.category)}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="5">No category offers yet.</td></tr>';
  }
  document.getElementById('category-offer-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const category = offerCategory.value;
    const offers = readLocal('rj_offers');
    const offer = { category, discount: Number(document.getElementById('offer-discount').value), bannerText: document.getElementById('offer-banner-text').value.trim(), active: true };
    const index = offers.findIndex((item) => String(item.category).toLowerCase() === String(category).toLowerCase());
    if (index >= 0) offers[index] = { ...offers[index], ...offer }; else offers.unshift(offer);
    saveLocal('rj_offers', offers); event.target.reset(); selectCategory(offerCategory, category); renderOffers(); showSuccess('Category offer saved successfully');
  });
  offersBody?.addEventListener('click', async (event) => {
    const category = event.target.closest('[data-offer-toggle]')?.dataset.offerToggle || event.target.closest('[data-offer-delete]')?.dataset.offerDelete;
    if (!category) return;
    const offers = readLocal('rj_offers'); const offer = offers.find((item) => item.category === category);
    if (event.target.closest('[data-offer-toggle]')) { offer.active = !offer.active; saveLocal('rj_offers', offers); renderOffers(); return showSuccess('Category offer updated'); }
    if (!(await confirmAction(`Delete the ${category} offer?`, 'This cannot be undone.'))) return;
    saveLocal('rj_offers', offers.filter((item) => item.category !== category)); renderOffers(); showSuccess('Category offer deleted successfully');
  });

  // Seasonal highlight manager. It persists references to catalog products, never image files.
  const seasonalForm = document.getElementById('seasonal-highlight-form');
  const seasonalPicker = document.getElementById('seasonal-product-picker');
  const seasonalSelected = document.getElementById('seasonal-selected-products');
  const seasonalPreview = document.getElementById('seasonal-highlight-preview');
  let seasonalSettings = { label: '', title: '', description: '', rotationInterval: 3000, productIds: [] };
  let seasonalHighlightRowId = null;
  let seasonalPreviewSlide = 0;
  let seasonalPreviewTimer;
  const seasonalImage = (product) => product?.variants?.[0]?.image || product?.variants?.[0]?.images?.[0] || product?.image || '';

  function selectedSeasonalProducts() {
    return seasonalSettings.productIds.map((id) => (window.currentProducts || []).find((product) => String(product.id) === String(id))).filter(Boolean);
  }

  function syncSeasonalSettingsFromForm() {
    if (!seasonalForm) return;
    seasonalSettings.label = document.getElementById('seasonal-label').value.trim();
    seasonalSettings.title = document.getElementById('seasonal-title').value.trim();
    seasonalSettings.description = document.getElementById('seasonal-description').value.trim();
    seasonalSettings.rotationInterval = Number(document.getElementById('seasonal-rotation-interval').value) || 3000;
  }

  function renderSeasonalManager() {
    if (!seasonalForm) return;
    const products = window.currentProducts || [];
    seasonalSettings.productIds = seasonalSettings.productIds.filter((id) => products.some((product) => String(product.id) === String(id)));
    seasonalPicker.innerHTML = products.length ? products.map((product) => {
      const checked = seasonalSettings.productIds.includes(String(product.id));
      return `<label class="seasonal-product-option"><input type="checkbox" value="${escapeHtml(product.id)}" ${checked ? 'checked' : ''}><img src="${escapeHtml(seasonalImage(product))}" alt=""><span>${escapeHtml(product.name || 'Untitled product')}</span></label>`;
    }).join('') : '<p>No products available yet.</p>';
    const selected = selectedSeasonalProducts();
    seasonalSelected.innerHTML = selected.length ? selected.map((product, index) => `<div class="seasonal-selected-item"><img src="${escapeHtml(seasonalImage(product))}" alt=""><strong>${escapeHtml(product.name)}</strong><button type="button" class="btn-sm btn-edit" data-seasonal-move="up" data-seasonal-id="${escapeHtml(product.id)}" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button><button type="button" class="btn-sm btn-edit" data-seasonal-move="down" data-seasonal-id="${escapeHtml(product.id)}" ${index === selected.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button><button type="button" class="btn-sm btn-delete" data-seasonal-remove="${escapeHtml(product.id)}"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : '<p style="color:#6b635b;font-size:13px;">Choose products to create the rotating image pairs.</p>';
    renderSeasonalPreview();
  }

  function renderSeasonalPreview() {
    if (!seasonalPreview) return;
    syncSeasonalSettingsFromForm();
    const previewProducts = selectedSeasonalProducts();
    const previewSlides = [];
    for (let start = 0; start < previewProducts.length; start += 2) {
      previewSlides.push([previewProducts[start], previewProducts[(start + 1) % previewProducts.length]]);
    }
    seasonalPreviewSlide = previewSlides.length ? seasonalPreviewSlide % previewSlides.length : 0;
    const selected = previewSlides[seasonalPreviewSlide] || [];
    seasonalPreview.innerHTML = `<div class="seasonal-preview__layout">
      <div class="seasonal-preview__media">${selected.length
        ? selected.map((product) => `<img class="seasonal-preview__image" src="${escapeHtml(seasonalImage(product))}" alt="">`).join('')
        : '<p class="seasonal-preview__empty">Select products to preview the image area.</p>'}${selected.length ? `<div class="seasonal-preview__pagination" aria-hidden="true">${previewSlides.map((_, index) => `<span class="seasonal-preview__dot${index === seasonalPreviewSlide ? ' is-active' : ''}"></span>`).join('')}</div>` : ''}</div>
      <div class="seasonal-preview__content"><span class="seasonal-preview-label">${escapeHtml(seasonalSettings.label || 'SEASON HIGHLIGHT')}</span><div class="seasonal-preview__divider" aria-hidden="true"></div><h3>${escapeHtml(seasonalSettings.title || 'Seasonal title')}</h3><p>${escapeHtml(seasonalSettings.description || 'Your seasonal editorial description will appear here.')}</p></div>
    </div>`;
    clearInterval(seasonalPreviewTimer);
    if (previewSlides.length > 1) {
      seasonalPreviewTimer = setInterval(() => {
        seasonalPreviewSlide = (seasonalPreviewSlide + 1) % previewSlides.length;
        renderSeasonalPreview();
      }, 5000);
    }
  }

  async function loadSeasonalHighlight() {
    if (!seasonalForm) return;
    try {
      const { data, error } = await requireSupabase()
        .from('seasonal_highlight')
        .select('id, label, title, description, rotation_interval, product_ids')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Unable to load seasonal highlight.');
      seasonalHighlightRowId = data.id;
      seasonalSettings = {
        ...seasonalSettings,
        label: data.label || '',
        title: data.title || '',
        description: data.description || '',
        rotationInterval: data.rotation_interval,
        productIds: (data.product_ids || []).map(String)
      };
      document.getElementById('seasonal-label').value = seasonalSettings.label || '';
      document.getElementById('seasonal-title').value = seasonalSettings.title || '';
      document.getElementById('seasonal-description').value = seasonalSettings.description || '';
      document.getElementById('seasonal-rotation-interval').value = seasonalSettings.rotationInterval || 3000;
      renderSeasonalManager();
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to load seasonal highlight.');
    }
  }

  seasonalPicker?.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const id = String(event.target.value);
    if (event.target.checked) {
      if (seasonalSettings.productIds.length >= 10) { event.target.checked = false; return showError('You can select up to 10 products.'); }
      seasonalSettings.productIds.push(id);
    } else seasonalSettings.productIds = seasonalSettings.productIds.filter((productId) => productId !== id);
    renderSeasonalManager();
  });
  seasonalSelected?.addEventListener('click', (event) => {
    const removeId = event.target.closest('[data-seasonal-remove]')?.dataset.seasonalRemove;
    const moveButton = event.target.closest('[data-seasonal-move]');
    if (removeId) seasonalSettings.productIds = seasonalSettings.productIds.filter((id) => id !== String(removeId));
    if (moveButton) {
      const index = seasonalSettings.productIds.indexOf(String(moveButton.dataset.seasonalId));
      const target = moveButton.dataset.seasonalMove === 'up' ? index - 1 : index + 1;
      if (index >= 0 && target >= 0 && target < seasonalSettings.productIds.length) [seasonalSettings.productIds[index], seasonalSettings.productIds[target]] = [seasonalSettings.productIds[target], seasonalSettings.productIds[index]];
    }
    renderSeasonalManager();
  });
  seasonalForm?.addEventListener('input', renderSeasonalPreview);
  seasonalForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncSeasonalSettingsFromForm();
    try {
      if (!seasonalHighlightRowId) throw new Error('Unable to save seasonal highlight.');
      if (seasonalSettings.productIds.length > 10) throw new Error('Select up to 10 products.');
      const availableIds = new Set((window.currentProducts || []).map((product) => String(product.id)));
      const productIds = [];
      for (const productId of seasonalSettings.productIds) {
        const id = String(productId);
        if (!availableIds.has(id)) throw new Error('One or more selected products no longer exist.');
        if (!productIds.includes(id)) productIds.push(id);
      }
      const interval = Number(seasonalSettings.rotationInterval);
      if (!Number.isFinite(interval)) throw new Error('Rotation interval must be a number.');
      if (interval < 1000 || interval > 60000) throw new Error('Rotation interval must be between 1000 and 60000.');
      const { data, error } = await requireSupabase()
        .from('seasonal_highlight')
        .update({
          label: seasonalSettings.label,
          title: seasonalSettings.title,
          description: seasonalSettings.description,
          rotation_interval: interval,
          product_ids: productIds,
          updated_at: new Date().toISOString()
        })
        .eq('id', seasonalHighlightRowId)
        .select('id, label, title, description, rotation_interval, product_ids')
        .single();
      if (error) throw error;
      seasonalHighlightRowId = data.id;
      seasonalSettings = {
        ...seasonalSettings,
        label: data.label || '',
        title: data.title || '',
        description: data.description || '',
        rotationInterval: data.rotation_interval,
        productIds: (data.product_ids || []).map(String)
      };
      renderSeasonalManager();
      showSuccess('Seasonal highlight saved successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to save seasonal highlight.');
    }
  });
  window.refreshSeasonalHighlightManager = renderSeasonalManager;

  loadCategories();
  loadSeasonalHighlight();
  renderOrders();
  loadCoupons();
  renderOffers();
  openTab('dashboard-tab');
});
