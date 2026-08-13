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

const API_BASE = 'http://127.0.0.1:5000';

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

    const formData = new FormData();
    formData.append('name', document.getElementById('prod-name').value.trim());
    formData.append('price', document.getElementById('prod-price').value);
    formData.append('category', document.getElementById('prod-category').value);
    formData.append('sizes', document.getElementById('prod-sizes').value);
    formData.append('variants', JSON.stringify(variantData.variants));
    variantData.files.forEach(({ field, file }) => formData.append(field, file));

    const url = productId ? `${API_BASE}/api/products/${productId}` : `${API_BASE}/api/products`;
    try {
      const response = await fetch(url, { method: productId ? 'PUT' : 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to save product');
      showSuccess(productId ? 'Product updated successfully' : 'Product added successfully');
      resetForm();
      loadProducts();
    } catch (error) {
      console.error(error);
      showError(error.message || 'Could not connect to server');
    }
  });

  async function loadProducts() {
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (!response.ok) throw new Error('Unable to load products');
      const products = await response.json();
      window.currentProducts = products;
      window.refreshAdminCategoryUI?.();
      window.refreshSeasonalHighlightManager?.();
      tbody.innerHTML = '';
      count.textContent = products.length;

      products.forEach((product) => {
        const sizes = Array.isArray(product.size) ? product.size.join(', ') : (product.size || product.sizes || '-');
        const variants = Array.isArray(product.variants) ? product.variants : [];
        const colorsHtml = variants.length
          ? variants.map((variant) => {
            const variantImage = variant.image || variant.images?.[0];
            return variantImage
              ? `<div class="variant-thumb" title="${variant.label}"><img src="${variantImage}" alt="${variant.label}"></div>`
              : `<div class="variant-thumb variant-thumb-placeholder" title="${variant.label || 'Variant image unavailable'}" aria-label="${variant.label || 'Variant image unavailable'}"></div>`;
          }).join('')
          : '<span style="color:#999;">—</span>';
        const image = variants[0]?.image || variants[0]?.images?.[0] || product.image || '';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${image ? `<img src="${image}" width="50" style="border-radius:6px;">` : '—'}</td>
          <td>${product.id}</td><td>${product.name}</td><td>${product.category}</td><td>₹${product.price}</td>
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
    if (editId) editProduct(Number(editId));
    if (deleteId) await deleteProduct(Number(deleteId));
  });

  function editProduct(id) {
    const product = window.currentProducts.find((item) => item.id === id);
    if (!product) return;
    document.getElementById('product-id').value = product.id;
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-price').value = product.price || '';
    window.setAdminCategorySelect?.('prod-category', product.category || 'tops');
    document.getElementById('prod-sizes').value = Array.isArray(product.size) ? product.size.join(', ') : (product.size || product.sizes || '');
    const variants = Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : [{ label: 'Default', swatchType: 'color', swatchValue: '#0f766e', image: product.image || '' }];
    window.adminVariants.populate(variants);
    title.textContent = 'Edit Product';
    saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Product';
    cancelButton.style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!(await confirmDelete())) return;
    try {
      const response = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to delete product');
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
    item.dataset.existingImage = variant.image || legacyImage || '';
    item.dataset.existingSwatch = variant.swatchValue || '';
    item.dataset.solidSwatch = variant.swatchType === 'color' && variant.swatchValue
      ? variant.swatchValue
      : '#0f766e';
    item.querySelector('.variant-name').value = variant.label || '';
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
      if (!label || (!imageFile && !existingImage)) {
        showError('Each color needs a name and one product photo.');
        return null;
      }
      const swatchFile = item.querySelector('.variant-swatch-image').files[0];
      const existingSwatch = item.dataset.existingSwatch || '';
      if (swatchType === 'image' && !swatchFile && !existingSwatch) {
        showError('Please choose a swatch image for each printed or mixed color.');
        return null;
      }
      variants.push({
        label,
        swatchType,
        swatchValue: swatchType === 'color' ? item.dataset.solidSwatch : existingSwatch,
        image: existingImage
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
  }

  tabButtons.forEach((button) => button.addEventListener('click', () => openTab(button.dataset.tab)));
  openTab(localStorage.getItem('rj_admin_active_tab') || 'products-tab');

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
      select.innerHTML = categories.map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');
      selectCategory(select, selected);
      delete select.dataset.pendingCategory;
    });
  }

  function productCount(category) {
    return (window.currentProducts || []).filter((product) => String(product.category || '').toLowerCase() === String(category.name).toLowerCase()).length;
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
      const response = await fetch(`${API_BASE}/api/categories`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load categories.');
      categories = data;
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
      const response = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to add category.');
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
    const category = categories.find((item) => item.id === categoryId);
    if (!category || !(await confirmAction(`Delete category “${category.name}”?`, 'This cannot be undone.'))) return;
    try {
      const response = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to delete category.');
      await loadCategories();
      showSuccess('Category deleted successfully');
    } catch (error) {
      console.error(error);
      showError(error.message || 'Unable to delete category.');
    }
  });

  const statusOptions = ['Pending', 'Order Confirmed', 'On The Way', 'Delivered'];
  const statusClass = (status) => ({
    'Pending': 'pending', 'Order Confirmed': 'confirmed', 'On The Way': 'ontheway', 'Delivered': 'delivered'
  }[status] || 'pending');
  function renderOrders() {
    if (!ordersBody) return;
    const orders = readLocal('rj_orders');
    ordersBody.innerHTML = orders.length ? orders.map((order) => `
      <tr><td>${escapeHtml(order.id)}</td><td>${escapeHtml(order.customerName || 'Customer')}</td><td>${escapeHtml(order.phone || '—')}</td>
      <td>${escapeHtml(order.product || '—')} (${escapeHtml(order.size || 'Standard')})</td><td>₹${escapeHtml(order.amount || '—')}</td>
      <td><span class="status-badge status-${statusClass(order.status || 'Pending')}">${escapeHtml(order.status || 'Pending')}</span></td>
      <td><select class="form-control" data-order-status="${escapeHtml(order.id)}">${statusOptions.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
      <td><div class="action-btns"><button class="btn-sm btn-whatsapp" data-order-whatsapp="${escapeHtml(order.id)}"><i class="fa-brands fa-whatsapp"></i> Notify</button></div></td></tr>`).join('')
      : '<tr><td colspan="8">No WhatsApp orders yet.</td></tr>';
  }
  ordersBody?.addEventListener('change', (event) => {
    const id = event.target.dataset.orderStatus;
    if (!id) return;
    const orders = readLocal('rj_orders');
    const order = orders.find((item) => String(item.id) === String(id));
    if (!order) return;
    order.status = event.target.value;
    saveLocal('rj_orders', orders);
    renderOrders();
    showSuccess('Order status updated');
  });
  ordersBody?.addEventListener('click', (event) => {
    const id = event.target.closest('[data-order-whatsapp]')?.dataset.orderWhatsapp;
    if (!id) return;
    const order = readLocal('rj_orders').find((item) => String(item.id) === String(id));
    const phone = String(order?.phone || '').replace(/\D/g, '');
    if (!phone) return showError('This order does not have a customer phone number.');
    const message = `Hello ${order.customerName || ''}, your RJ Ladies Fashion order ${order.id} is now: ${order.status || 'Pending'}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  });
  document.getElementById('add-dummy-order-btn')?.addEventListener('click', () => {
    const orders = readLocal('rj_orders');
    orders.unshift({ id: `RJ${Date.now()}`, customerName: 'Sample Customer', phone: '', product: 'Sample Product', size: 'M', amount: 999, status: 'Pending', date: new Date().toLocaleDateString() });
    saveLocal('rj_orders', orders); renderOrders(); showSuccess('Sample order added');
  });

  function renderCoupons() {
    if (!couponsBody) return;
    const coupons = readLocal('rj_coupons');
    couponsBody.innerHTML = coupons.length ? coupons.map((coupon) => `<tr><td>${escapeHtml(coupon.code)}</td><td>${escapeHtml(coupon.discount)}% OFF</td><td>₹${escapeHtml(coupon.minSpend)}+</td><td>${escapeHtml(coupon.description || '—')}</td><td>${coupon.active ? 'Active' : 'Inactive'}</td><td><div class="action-btns"><button class="btn-sm btn-edit" data-coupon-toggle="${escapeHtml(coupon.code)}">${coupon.active ? 'Disable' : 'Enable'}</button><button class="btn-sm btn-delete" data-coupon-delete="${escapeHtml(coupon.code)}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="6">No coupons yet.</td></tr>';
  }
  document.getElementById('coupon-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const coupons = readLocal('rj_coupons');
    if (coupons.some((coupon) => String(coupon.code).toLowerCase() === String(code).toLowerCase())) return showError('A coupon with this code already exists.');
    coupons.unshift({ code, discount: Number(document.getElementById('coupon-discount').value), minSpend: Number(document.getElementById('coupon-min-spend').value), description: document.getElementById('coupon-desc').value.trim(), active: true });
    saveLocal('rj_coupons', coupons); event.target.reset(); renderCoupons(); showSuccess('Coupon created successfully');
  });
  couponsBody?.addEventListener('click', async (event) => {
    const code = event.target.closest('[data-coupon-toggle]')?.dataset.couponToggle || event.target.closest('[data-coupon-delete]')?.dataset.couponDelete;
    if (!code) return;
    const coupons = readLocal('rj_coupons'); const coupon = coupons.find((item) => item.code === code);
    if (event.target.closest('[data-coupon-toggle]')) { coupon.active = !coupon.active; saveLocal('rj_coupons', coupons); renderCoupons(); return showSuccess('Coupon updated'); }
    if (!(await confirmAction(`Delete coupon “${code}”?`, 'This cannot be undone.'))) return;
    saveLocal('rj_coupons', coupons.filter((item) => item.code !== code)); renderCoupons(); showSuccess('Coupon deleted successfully');
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
      const response = await fetch(`${API_BASE}/api/seasonal-highlight`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to load seasonal highlight.');
      seasonalSettings = { ...seasonalSettings, ...data, productIds: (data.productIds || []).map(String) };
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
      const response = await fetch(`${API_BASE}/api/seasonal-highlight`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(seasonalSettings) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to save seasonal highlight.');
      seasonalSettings = { ...seasonalSettings, ...data.settings, productIds: (data.settings.productIds || []).map(String) };
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
  renderCoupons();
  renderOffers();
});
