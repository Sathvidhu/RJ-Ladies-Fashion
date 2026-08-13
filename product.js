const API_BASE = 'http://127.0.0.1:5000';
const WHATSAPP_NUMBER = '919567308831';

document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('product-page');
  const mobileBar = document.getElementById('mobile-action-bar');
  const mobilePrice = document.getElementById('mobile-price');
  const mobileWhatsAppButton = document.getElementById('mobile-whatsapp-button');
  const productId = new URLSearchParams(window.location.search).get('id');

  const isLoggedIn = () => Boolean(localStorage.getItem('rj_user'));
  const guardWhatsAppCheckout = (event) => {
    if (isLoggedIn()) return true;
    event?.preventDefault();
    const message = 'Please login to continue checkout.';
    if (window.Swal) {
      Swal.fire({ icon: 'info', title: 'Login required', text: message, confirmButtonText: 'Login' })
        .then(() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' }));
    } else {
      window.alert(message);
    }
    return false;
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const primaryImage = (product) => product.variants?.[0]?.image || product.variants?.[0]?.images?.[0] || product.image || '';
  const productVariants = (product) => {
    const variants = (product.variants || []).map((variant, index) => ({
      label: variant.label || `Variant ${index + 1}`,
      image: variant.image || variant.images?.[0] || product.image || ''
    })).filter((variant) => variant.image);
    return variants.length ? variants : [{ label: 'Default', image: primaryImage(product) }];
  };

  if (!productId) return renderNotFound();
  loadProduct();

  async function loadProduct() {
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (!response.ok) throw new Error('The collection could not be loaded.');
      const products = await response.json();
      const product = products.find((item) => String(item.id) === String(productId));
      if (!product) return renderNotFound();
      renderProduct(product, products);
    } catch (error) {
      console.error(error);
      renderNotFound('We could not load this product right now.');
    }
  }

  function renderNotFound(message = 'This product is no longer available.') {
    mobileBar.hidden = true;
    page.innerHTML = `<section class="not-found"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><h1>Product not found</h1><p>${escapeHtml(message)}</p><a class="shop-link" href="index.html">Back to shop</a></section>`;
  }

  function renderProduct(product, products) {
    const variants = productVariants(product);
    const sizes = Array.isArray(product.size) && product.size.length ? product.size : ['Standard'];
    let selectedVariant = variants[0];
    let selectedSize = sizes[0];
    const description = product.description || `A carefully selected ${product.category || 'fashion'} piece from RJ Ladies Fashion, designed for effortless everyday elegance.`;
    const safeName = escapeHtml(product.name);

    page.innerHTML = `
      <section class="product-layout">
        <div class="gallery-panel">
          <div class="main-image-wrap"><img id="main-product-image" class="main-image" src="${escapeHtml(selectedVariant.image)}" alt="${safeName} - ${escapeHtml(selectedVariant.label)}"></div>
          <div id="thumbnail-list" class="thumbnail-list" aria-label="Product image gallery"></div>
        </div>
        <article class="details-panel">
          <p class="category-label">${escapeHtml(product.category || 'RJ Collection')}</p>
          <h1 class="product-title">${safeName}</h1>
          <p class="product-price">₹${escapeHtml(product.price)}</p>
          <p class="offer-copy"><i class="fa-solid fa-circle-check"></i> Free delivery on orders above ₹999</p>
          <section class="detail-section"><h2>About this piece</h2><p class="description">${escapeHtml(description)}</p></section>
          <section class="detail-section"><h2>Choose colour</h2><p id="selected-variant-label" class="selected-variant-label">Selected: ${escapeHtml(selectedVariant.label)}</p><div id="variant-options" class="variant-options" aria-label="Choose colour"></div></section>
          <section class="detail-section"><h2>Select size</h2><div id="size-options" class="size-options" aria-label="Select size"></div></section>
          <section class="detail-section"><div class="delivery-card"><div class="delivery-item"><i class="fa-solid fa-truck-fast"></i> Free delivery above ₹999</div><div class="delivery-item"><i class="fa-solid fa-rotate-left"></i> Easy returns within 7 days</div><div class="delivery-item"><i class="fa-solid fa-money-bill-wave"></i> Cash on Delivery available</div></div></section>
          <button id="whatsapp-button" class="whatsapp-button"><i class="fa-brands fa-whatsapp"></i> Order on WhatsApp</button>
        </article>
      </section>
      <section class="recommendation-section"><h2 class="recommendation-heading">Related products</h2><div id="related-products" class="recommendation-list"></div></section>
      <section class="recommendation-section"><h2 class="recommendation-heading">You may also like</h2><div id="also-like-products" class="recommendation-list"></div></section>`;

    const mainImage = document.getElementById('main-product-image');
    const thumbnails = document.getElementById('thumbnail-list');
    const variantOptions = document.getElementById('variant-options');
    const variantLabel = document.getElementById('selected-variant-label');
    const sizeOptions = document.getElementById('size-options');

    const selectVariant = (variant) => {
      selectedVariant = variant;
      mainImage.src = variant.image;
      mainImage.alt = `${product.name} - ${variant.label}`;
      mainImage.classList.remove('fade');
      void mainImage.offsetWidth;
      mainImage.classList.add('fade');
      variantLabel.textContent = `Selected: ${variant.label}`;
      thumbnails.querySelectorAll('[data-variant-index]').forEach((button, index) => button.classList.toggle('is-selected', variants[index] === variant));
      variantOptions.querySelectorAll('[data-variant-index]').forEach((button, index) => {
        const active = variants[index] === variant;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };

    variants.forEach((variant, index) => {
      const thumbnail = document.createElement('button');
      thumbnail.type = 'button'; thumbnail.className = `thumbnail-button${index === 0 ? ' is-selected' : ''}`;
      thumbnail.dataset.variantIndex = index; thumbnail.setAttribute('aria-label', `Show ${variant.label}`);
      thumbnail.innerHTML = `<img src="${escapeHtml(variant.image)}" alt="${escapeHtml(product.name)} in ${escapeHtml(variant.label)}" loading="lazy">`;
      thumbnail.addEventListener('click', () => selectVariant(variant));
      thumbnails.appendChild(thumbnail);

      const variantButton = document.createElement('button');
      variantButton.type = 'button'; variantButton.className = `variant-button${index === 0 ? ' is-selected' : ''}`;
      variantButton.dataset.variantIndex = index; variantButton.setAttribute('aria-label', `Select ${variant.label}`); variantButton.setAttribute('aria-pressed', String(index === 0));
      variantButton.innerHTML = `<img src="${escapeHtml(variant.image)}" alt="${escapeHtml(variant.label)}" loading="lazy">`;
      variantButton.addEventListener('click', () => selectVariant(variant));
      variantOptions.appendChild(variantButton);
    });

    sizes.forEach((size, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `size-button${index === 0 ? ' is-selected' : ''}`;
      button.textContent = size; button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => {
        selectedSize = size;
        sizeOptions.querySelectorAll('.size-button').forEach((item) => { const active = item === button; item.classList.toggle('is-selected', active); item.setAttribute('aria-pressed', String(active)); });
      });
      sizeOptions.appendChild(button);
    });

    const order = (event) => {
      if (!guardWhatsAppCheckout(event)) return;
      const message = `Hello, I want to order:\nProduct: ${product.name}\nVariant: ${selectedVariant.label}\nSize: ${selectedSize}\nPrice: ₹${product.price}`;
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    };
    document.getElementById('whatsapp-button').addEventListener('click', order);
    mobilePrice.textContent = `₹${product.price}`;
    mobileBar.hidden = false;
    mobileWhatsAppButton.addEventListener('click', order);

    const others = products.filter((item) => item.id !== product.id);
    const related = [...others.filter((item) => item.category === product.category), ...others.filter((item) => item.category !== product.category)].slice(0, 6);
    const relatedIds = new Set(related.map((item) => item.id));
    const alsoLike = others.filter((item) => !relatedIds.has(item.id)).slice(0, 6);
    renderRecommendations(document.getElementById('related-products'), related);
    renderRecommendations(document.getElementById('also-like-products'), alsoLike);
  }

  function renderRecommendations(container, products) {
    if (!products.length) { container.closest('.recommendation-section').hidden = true; return; }
    container.innerHTML = products.map((product) => `<a class="recommendation-card" href="product.html?id=${encodeURIComponent(product.id)}"><img src="${escapeHtml(primaryImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy"><div class="recommendation-info"><strong>${escapeHtml(product.name)}</strong><span>₹${escapeHtml(product.price)}</span></div></a>`).join('');
  }
});
