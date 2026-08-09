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
    document.getElementById('prod-category').value = product.category || 'tops';
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
