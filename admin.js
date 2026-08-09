// ==========================================
// ADMIN LOGIN PROTECTION
// ==========================================
function getSession() {
  try {
    return JSON.parse(localStorage.getItem('rj_session'));
  } catch {
    return null;
  }
}

const session = getSession();

if (!session || session.role !== 'admin') {
  alert('Please login as Admin from the main website.');
  window.location.href = 'index.html';
}

const API_BASE = 'http://127.0.0.1:5000';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('product-form');
  const tbody = document.getElementById('admin-products-tbody');
  const count = document.getElementById('total-products-count');
  const imageInput = document.getElementById('product-image');
  const imagePreview = document.getElementById('image-preview');
  const fileName = document.getElementById('selected-file-name');

  let editingImageUrl = '';

  loadProducts();

  // Image preview
  imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  // Save / Update product
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productId = document.getElementById('product-id').value;

    const formData = new FormData();
    formData.append('name', document.getElementById('prod-name').value);
    formData.append('price', document.getElementById('prod-price').value);
    formData.append('category', document.getElementById('prod-category').value);
    formData.append('sizes', document.getElementById('prod-sizes').value);

    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    } else {
      formData.append('existing_image', editingImageUrl);
    }

    let url = `${API_BASE}/api/products`;
    let method = 'POST';

    if (productId) {
      url = `${API_BASE}/api/products/${productId}`;
      method = 'PUT';
    }

    try {
      const res = await fetch(url, {
        method,
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        alert(productId ? 'Product updated successfully' : 'Product added successfully');
        resetForm();
        loadProducts();
      } else {
        alert('Failed to save product');
      }
    } catch (err) {
      console.error(err);
      alert('Could not connect to server');
    }
  });

  // Load products table
  async function loadProducts() {
    const res = await fetch(`${API_BASE}/api/products`);
    const products = await res.json();

    tbody.innerHTML = '';
    count.textContent = products.length;

    products.forEach(product => {
      const sizes = Array.isArray(product.size)
        ? product.size.join(', ')
        : (product.size || product.sizes || '-');
        const colorsHtml = product.variants
        ? product.variants.map(v => {
            if (v.swatchType === 'image') {
                return `
                    <img src="${v.swatchValue}"
                        title="${v.label}"
                        class="admin-color-swatch-image">
                `;
            } else {
                return `
                    <span class="admin-color-swatch"
                        title="${v.label}"
                        style="background:${v.swatchValue}"></span>
                `;
            }
            }).join('')
        : '<span style="color:#999;">—</span>';
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
            <img src="${product.variants && product.variants.length
                ? product.variants[0].images[0]
                : product.image}"
                width="50"
                style="border-radius:6px;">
        </td>
                    <td>${product.id}</td>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>₹${product.price}</td>
        <td><div class="admin-colors-wrap">${colorsHtml}</div></td>
        <td>${sizes}</td>
        <td>
          <button type="button"
                    class="btn-sm btn-edit"
                    onclick="window.editProduct(${product.id})">
                Edit
            </button>

            <button type="button"
                    class="btn-sm btn-delete"
                    onclick="window.deleteProduct(${product.id})">
                Delete
            </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    window.currentProducts = products;
  }

  // Edit product
  window.editProduct = function (id) {
    const product = window.currentProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('product-id').value = product.id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-category').value = product.category;

    const sizes = Array.isArray(product.size)
      ? product.size.join(', ')
      : (product.size || product.sizes || '');

    document.getElementById('prod-sizes').value = sizes;

    editingImageUrl = product.image;editingImageUrl = product.variants && product.variants.length
    ? product.variants[0].images[0]
    : product.image;

    imagePreview.src = product.image;
    imagePreview.style.display = 'block';
    fileName.textContent = 'Current image loaded';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete product
  window.deleteProduct = async function (id) {
    if (!confirm('Delete this product?')) return;

    await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE'
    });

    loadProducts();
  };

  function resetForm() {
    form.reset();
    document.getElementById('product-id').value = '';
    editingImageUrl = '';
    imagePreview.src = '';
    imagePreview.style.display = 'none';
    fileName.textContent = 'No file selected';
  }
});
// ==========================================
// PRODUCT VARIANTS UI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    const variantsContainer = document.getElementById('variants-container');
    const addVariantBtn = document.getElementById('add-variant-btn');

    if (!variantsContainer || !addVariantBtn) return;

    // Toggle swatch type
    function bindVariantEvents(variantItem) {
        const typeSelect = variantItem.querySelector('.variant-swatch-type');
        const colorGroup = variantItem.querySelector('.color-picker-group');
        const imageGroup = variantItem.querySelector('.swatch-image-group');

        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'image') {
                colorGroup.style.display = 'none';
                imageGroup.style.display = 'block';
            } else {
                colorGroup.style.display = 'block';
                imageGroup.style.display = 'none';
            }
        });

        // Remove variant
        variantItem.querySelector('.remove-variant-btn')
            .addEventListener('click', () => {
                if (variantsContainer.children.length > 1) {
                    variantItem.remove();
                } else {
                    alert('At least one color variant is required.');
                }
            });
            // Preview multiple variant images
            const imageInput = variantItem.querySelector('.variant-images');
            const fileLabel = variantItem.querySelector('.variant-file-name');
            const previewGrid = variantItem.querySelector('.variant-preview-grid');

            if (imageInput) {
                imageInput.addEventListener('change', () => {
                    const files = Array.from(imageInput.files || []);

                    fileLabel.textContent = files.length
                        ? `${files.length} photo(s) selected`
                        : 'No photos selected';

                    previewGrid.innerHTML = '';

                    files.forEach(file => {
                        const reader = new FileReader();

                        reader.onload = e => {
                            const img = document.createElement('img');
                            img.src = e.target.result;
                            previewGrid.appendChild(img);
                        };

                        reader.readAsDataURL(file);
                    });
                });
            }
    }

    // Bind first variant
    bindVariantEvents(variantsContainer.querySelector('.variant-item'));

    // Add new variant
    addVariantBtn.addEventListener('click', () => {
        const first = variantsContainer.querySelector('.variant-item');
        const clone = first.cloneNode(true);

        // Clear values
        clone.querySelector('.variant-name').value = '';
        clone.querySelector('.variant-color').value = '#000000';
        clone.querySelector('.variant-swatch-type').value = 'color';
        clone.querySelector('.variant-images').value = '';
        clone.querySelector('.variant-swatch-image').value = '';

        clone.querySelector('.color-picker-group').style.display = 'block';
        clone.querySelector('.swatch-image-group').style.display = 'none';

        variantsContainer.appendChild(clone);
        bindVariantEvents(clone);
    });

});