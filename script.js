// RJ Ladies Fashion - Client Application Script
document.addEventListener("DOMContentLoaded", function () {
    console.log("RJ Ladies Fashion Client script initialized.");

    function showAlert(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        confirmButtonColor: "#8c3d3d"
    });
}


    // ==========================================
    // DOM REFERENCES
    // ==========================================
    const productsGrid = document.getElementById("products-grid");
    const loader = document.getElementById("loader");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const mobileToggle = document.getElementById("mobile-toggle");
    const navLinks = document.getElementById("nav-links");

    // Coupon Controls
    const globalCouponInput = document.getElementById("global-coupon-input");
    const applyCouponBtn = document.getElementById("apply-coupon-btn");
    const removeCouponBtn = document.getElementById("remove-coupon-btn");
    const couponMessage = document.getElementById("coupon-message");
    const announcementBar = document.getElementById("announcement-bar");
    const announcementText = document.getElementById("announcement-text");

    // Modal Order Tracker
    const trackerModal = document.getElementById("tracker-modal");
    const trackOrderHeaderBtn = document.getElementById("track-order-header-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const trackIdInput = document.getElementById("track-id-input");
    const searchOrderBtn = document.getElementById("search-order-btn");
    const trackResultBox = document.getElementById("track-result-box");

    // Auth Modal & Forms
    const authModal = document.getElementById("auth-modal");
    const closeAuthModalBtn = document.getElementById("close-auth-modal-btn");
    const openAuthBtn = document.getElementById("open-auth-btn");
    const loginForm = document.getElementById("login-form");
    const loginEmailInput = document.getElementById("login-email");
    const loginPasswordInput = document.getElementById("login-password");
    const loginError = document.getElementById("loginError");
    const loginErrorText = document.getElementById("loginErrorText");
    const loginErrorClose = document.querySelector(".login-error-close");
    const authNavSlot = document.getElementById("auth-nav-slot");
    const headerCart = document.getElementById("header-cart");
    const cartToggleBtn = document.getElementById("cart-toggle-btn");
    const cartDrawer = document.getElementById("cart-drawer");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartCloseBtn = document.getElementById("cart-close-btn");
    const cartItemsEl = document.getElementById("cart-items");
    const cartCountEl = document.getElementById("cart-count");
    const cartSubtotalEl = document.getElementById("cart-subtotal");
    const cartDiscountRow = document.getElementById("cart-discount-row");
    const cartDiscountEl = document.getElementById("cart-discount");
    const cartTotalEl = document.getElementById("cart-total");
    const cartCouponInput = document.getElementById("cart-coupon-input");
    const cartCouponMessage = document.getElementById("cart-coupon-message");
    const cartApplyCouponBtn = document.getElementById("cart-apply-coupon-btn");
    const cartCheckoutBtn = document.getElementById("cart-checkout-btn");
    const seasonalHighlightImages = document.getElementById("seasonal-highlight-images");
    const seasonalHighlightPagination = document.getElementById("seasonal-highlight-pagination");
    const seasonalHighlightLabel = document.getElementById("seasonal-highlight-label");
    const seasonalHighlightTitle = document.getElementById("seasonal-highlight-title");
    const seasonalHighlightDescription = document.getElementById("seasonal-highlight-description");
    let seasonalHighlightTimer;
    let seasonalHighlightTransitionTimer;
    let announcementRotationTimer;
    let announcementTransitionTimer;
    let announcementCoupons = [];
    let announcementIndex = 0;

    // ==========================================
    // HELPERS
    // ==========================================
    function getStoredData(key, fallback) {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        try { return JSON.parse(item); } catch (e) { return fallback; }
    }

    function saveStoredData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // ==========================================
    // AUTH SESSION MANAGEMENT
    // ==========================================
    // Session shape: { name, email, role: "customer"|"admin", loggedInAt }
    function getCurrentSession() {
        return getStoredData("rj_session", null);
    }

    function saveSession(sessionObj) {
        saveStoredData("rj_session", sessionObj);
        localStorage.setItem("rj_user", JSON.stringify(sessionObj));
    }

    function clearSession() {
        localStorage.removeItem("rj_session");
        localStorage.removeItem("rj_user");
    }

    // ==========================================
    // AUTH UI: ADMIN SESSION ONLY (no customer login)
    // ==========================================
    function renderAuthNavbar() {
        if (!authNavSlot) return;
        const session = getCurrentSession();

        if (session && session.role === "admin") {
            authNavSlot.innerHTML = `
                <div class="nav-user-box">
                    <span class="user-badge"><i class="fa-solid fa-shield-halved"></i> Admin</span>
                    <a href="admin.html" class="nav-admin-link">
                        <i class="fa-solid fa-user-gear"></i> Admin Portal
                    </a>
                    <button id="logout-btn" class="nav-auth-btn" style="font-size: 12px;">
                        <i class="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
                </div>
            `;
            document.getElementById("logout-btn").addEventListener("click", handleLogout);
        } else {
            authNavSlot.innerHTML = "";
        }
        updateCartVisibility();
    }

    function handleLogout() {
        clearSession();
        renderAuthNavbar();
        Swal.fire({
            icon: "success",
            title: "Logged out",
            text: "You have been logged out successfully.",
            confirmButtonColor: "#8c3d3d"
        });
    }

    // ==========================================
    // AUTH MODAL OPEN / CLOSE / TAB SWITCH
    // ==========================================
    function openAuthModal() {
        if (authModal) authModal.style.display = "flex";
        hideLoginError();
    }

    function closeAuthModal() {
        if (authModal) authModal.style.display = "none";
        hideLoginError();
    }

    function showLoginError(message) {
        loginErrorText.textContent = message;
        loginError.classList.remove("hidden");
    }

    function hideLoginError() {
        loginError.classList.add("hidden");
    }

    if (loginErrorClose) loginErrorClose.addEventListener("click", hideLoginError);
    if (loginEmailInput) loginEmailInput.addEventListener("input", hideLoginError);
    if (loginPasswordInput) loginPasswordInput.addEventListener("input", hideLoginError);

    if (openAuthBtn) openAuthBtn.addEventListener("click", openAuthModal);
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", closeAuthModal);

    if (authModal) {
        authModal.addEventListener("click", function (e) {
            if (e.target === authModal) closeAuthModal();
        });
    }

    // ==========================================
    // ADMIN LOGIN FORM HANDLER
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const emailInput = loginEmailInput.value.trim().toLowerCase();
            const passwordInput = loginPasswordInput.value;

            let adminUser = null;
            try {
                const { data, error } = await window.supabaseClient
                    .from('admin_users')
                    .select('*')
                    .eq('email', emailInput)
                    .eq('password_hash', passwordInput)
                    .single();
                if (error && error.code !== 'PGRST116') throw error;
                adminUser = data;
            } catch (error) {
                console.error('Admin login query failed:', error);
                showLoginError('Unable to verify login right now. Please try again.');
                return;
            }

            if (adminUser) {
                saveSession({
                    name: adminUser.name || "Admin",
                    email: adminUser.email,
                    role: "admin",
                    loggedInAt: new Date().toISOString()
                });
                hideLoginError();
                closeAuthModal();
                renderAuthNavbar();
                window.location.href = "admin.html";
                return;
            }

            showLoginError("Incorrect username or password.");
        });
    }

    

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    let allProducts = [];
    let activeCoupons = [];
    let activeOffers = getStoredData("rj_offers", []);
    let allOrders = [];
    let appliedCoupon = null;
    let cart = getStoredData("rj_cart", []);
    let cartCoupon = null;

    const fallbackVariantColors = {
        blue: "#7fd6e8", "navy blue": "#7fd6e8",
        maroon: "#7a2f38", brown: "#7a2f38",
        yellow: "#d7a52f"
    };

    function getVariantSwatchColor(variant, label) {
        const value = variant.swatchValue || variant.value || variant.hex || variant.code || variant.color || "";
        if (/^https?:\/\//i.test(String(value))) return value;
        const isHexColor = /^#[0-9a-f]{3,8}$/i.test(String(value));
        if (isHexColor && String(value).toLowerCase() !== "#0f766e") return value;
        return fallbackVariantColors[String(label || "").trim().toLowerCase()] || (isHexColor ? value : "#d8c8bb");
    }

    function getProductColors(product) {
        const colors = Array.isArray(product.colors) ? product.colors : (Array.isArray(product.variants) ? product.variants : []);
        const normalized = colors.map((color, index) => {
            if (typeof color === "string") return { name: color, value: fallbackVariantColors[color.trim().toLowerCase()] || color, image: product.image || "" };
            return {
                name: color.label || color.name || `Color ${index + 1}`,
                value: getVariantSwatchColor(color, color.label || color.name),
                image: color.image || (Array.isArray(color.images) ? color.images[0] : "") || product.image || ""
            };
        });
        return normalized.length ? normalized : [{ name: "Default", value: "#d8c8bb", image: getPrimaryImage(product) || "" }];
    }

    function getCartTotals() {
        if (window.RJCheckout) {
            const totals = window.RJCheckout.calculateTotals(cart, cartCoupon);
            return { subtotal: totals.subtotal, discount: totals.discount, total: totals.total };
        }
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
        return { subtotal, discount: 0, total: subtotal };
    }

    function renderCart() {
        if (!cartItemsEl) return;
        const { subtotal, discount, total } = getCartTotals();
        cartItemsEl.innerHTML = cart.length ? cart.map((item, index) => `
            <article class="cart-item"><img src="${item.image}" alt="${item.name}"><div class="cart-item-info"><strong>${item.name}</strong><small>${item.color} · ${item.size}</small><span>₹${Number(item.price) * item.qty}</span><div class="cart-qty"><button type="button" data-cart-qty="${index}" data-change="-1" aria-label="Decrease quantity">−</button><b>${item.qty}</b><button type="button" data-cart-qty="${index}" data-change="1" aria-label="Increase quantity">+</button><button type="button" class="cart-remove" data-cart-remove="${index}">Remove</button></div></div></article>`).join("") : '<p class="cart-empty">Your bag is waiting for a beautiful pick.</p>';
        if (cartCountEl) cartCountEl.textContent = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (cartSubtotalEl) cartSubtotalEl.textContent = `₹${subtotal}`;
        if (cartDiscountEl) cartDiscountEl.textContent = `-₹${discount}`;
        if (cartDiscountRow) cartDiscountRow.hidden = !discount;
        if (cartTotalEl) cartTotalEl.textContent = `₹${total}`;
        if (cartCheckoutBtn) cartCheckoutBtn.disabled = !cart.length;
    }

    function saveCart() { saveStoredData("rj_cart", cart); renderCart(); }
    function openCart() { cartDrawer?.classList.add("open"); cartOverlay.hidden = false; cartDrawer?.setAttribute("aria-hidden", "false"); }
    function closeCart() { cartDrawer?.classList.remove("open"); cartOverlay.hidden = true; cartDrawer?.setAttribute("aria-hidden", "true"); }
    function addToCart(product, card) {
        const color = card.dataset.selectedColor || "Default";
        const size = card.dataset.selectedSize || "Standard";
        const image = card.dataset.selectedImage || getPrimaryImage(product) || "";
        const existing = cart.find(item => String(item.productId) === String(product.id) && item.color === color && item.size === size);
        if (existing) existing.qty += 1;
        else cart.push({ productId: product.id, name: product.name, price: Number(product.price), image, color, size, variant: color, qty: 1 });
        saveCart(); openCart();
    }

    function updateCartVisibility() {
        if (headerCart) headerCart.style.display = "flex";
        if (cartToggleBtn) cartToggleBtn.hidden = false;
        document.querySelectorAll(".btn-cart").forEach(button => { button.hidden = false; });
    }

    function openStoreCheckout() {
        if (!cart.length) return;
        closeCart();
        window.RJCheckout.open({
            items: cart,
            coupons: activeCoupons,
            appliedCoupon: cartCoupon,
            onAppliedCoupon: (coupon) => {
                cartCoupon = coupon;
                if (cartCouponInput) cartCouponInput.value = coupon?.code || "";
                if (cartCouponMessage) {
                    cartCouponMessage.textContent = coupon ? `${coupon.code} applied.` : "";
                    cartCouponMessage.className = coupon ? "cart-coupon-message success" : "cart-coupon-message";
                }
                renderCart();
            }
        });
    }

    cartToggleBtn?.addEventListener("click", openCart);
    cartCloseBtn?.addEventListener("click", closeCart);
    cartOverlay?.addEventListener("click", closeCart);
    cartItemsEl?.addEventListener("click", event => {
        const remove = event.target.closest("[data-cart-remove]");
        const quantity = event.target.closest("[data-cart-qty]");
        if (remove) { cart.splice(Number(remove.dataset.cartRemove), 1); saveCart(); }
        if (quantity) { const item = cart[Number(quantity.dataset.cartQty)]; if (!item) return; item.qty += Number(quantity.dataset.change); if (item.qty < 1) cart.splice(Number(quantity.dataset.cartQty), 1); saveCart(); }
    });
    cartApplyCouponBtn?.addEventListener("click", () => {
        const code = String(cartCouponInput?.value || "").trim();
        const coupon = activeCoupons.find((item) => String(item.code || "").trim().toLowerCase() === code.toLowerCase());
        const mapped = window.RJCheckout ? window.RJCheckout.mapCoupon(coupon) : coupon;
        const valid = window.RJCheckout ? window.RJCheckout.isCouponValid(mapped) : Boolean(mapped);
        if (!valid) {
            cartCoupon = null;
            cartCouponMessage.textContent = "Enter a valid active coupon that has not expired.";
            cartCouponMessage.className = "cart-coupon-message error";
            renderCart();
            return;
        }
        if (getCartTotals().subtotal < Number(mapped.minSpend || 0)) {
            cartCoupon = null;
            cartCouponMessage.textContent = `This coupon requires a minimum order of ₹${mapped.minSpend}.`;
            cartCouponMessage.className = "cart-coupon-message error";
            renderCart();
            return;
        }
        cartCoupon = mapped;
        cartCouponMessage.textContent = `${mapped.code} applied.`;
        cartCouponMessage.className = "cart-coupon-message success";
        renderCart();
    });

    cartCheckoutBtn?.addEventListener("click", () => {
        if (!cart.length) return;
        openStoreCheckout();
    });

    // Mobile Navbar Navigation Toggle
    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener("click", function () {
            navLinks.classList.toggle("show");
        });
        navLinks.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => navLinks.classList.remove("show"));
        });
    }

    // ==========================================
    // 1. LOAD PRODUCTS & COUPONS (SUPABASE)
    // ==========================================
    function mapSupabaseProduct(rawProduct) {
        const categoryName = rawProduct.categories?.name || 'Uncategorized';
        const categorySlug = rawProduct.categories?.slug || categoryName.toLowerCase();

        const rawProductImages = Array.isArray(rawProduct.product_images) ? rawProduct.product_images : [];
        const sortedProdImages = [...rawProductImages].sort((a, b) =>
            Number(b.is_primary || 0) - Number(a.is_primary || 0) || Number(a.sort_order || 0) - Number(b.sort_order || 0)
        );
        const primaryImgUrl = sortedProdImages[0]?.image_url || '';

        const rawVariants = Array.isArray(rawProduct.product_variants)
            ? rawProduct.product_variants.filter(v => v.is_active !== false)
            : [];

        const mappedVariants = rawVariants.map((v, index) => {
            const varImages = Array.isArray(v.product_images) ? v.product_images : [];
            const sortedVarImages = [...varImages].sort((a, b) =>
                Number(b.is_primary || 0) - Number(a.is_primary || 0) || Number(a.sort_order || 0) - Number(b.sort_order || 0)
            );
            const varImgUrl = sortedVarImages[0]?.image_url || primaryImgUrl;

            return {
                id: v.id,
                label: v.color || `Variant ${index + 1}`,
                name: v.color || `Variant ${index + 1}`,
                color: v.color || `Variant ${index + 1}`,
                size: v.size || 'Standard',
                sku: v.sku || '',
                price: Number(v.price ?? rawProduct.compare_price ?? 0),
                stock: Number(v.stock ?? 0),
                image: varImgUrl,
                images: [varImgUrl]
            };
        });

        const sizes = [...new Set(mappedVariants.map(v => v.size).filter(Boolean))];
        const finalSizes = sizes.length ? sizes : ['Standard'];
        const mainImage = primaryImgUrl || mappedVariants[0]?.image || '';

        return {
            id: String(rawProduct.id),
            name: rawProduct.name || 'Untitled Product',
            slug: rawProduct.slug || '',
            description: rawProduct.description || '',
            category: categorySlug,
            category_id: rawProduct.category_id,
            price: Number(rawProduct.compare_price ?? mappedVariants[0]?.price ?? 0),
            size: finalSizes,
            image: mainImage,
            variants: mappedVariants.length ? mappedVariants : [{
                id: 'default',
                label: 'Default',
                name: 'Default',
                color: 'Default',
                size: finalSizes[0],
                price: Number(rawProduct.compare_price ?? 0),
                image: mainImage,
                images: [mainImage]
            }]
        };
    }

    async function loadProducts() {
        if (loader) loader.style.display = "flex";

        try {
            if (!window.supabaseClient) {
                throw new Error("Supabase client is not available.");
            }
            const { data, error } = await window.supabaseClient
                .from('products')
                .select('*, categories(id, name, slug), product_images(*), product_variants(*, product_images(*))')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            allProducts = (data || []).map(mapSupabaseProduct);
        } catch (err) {
            console.error("Failed to load products from Supabase:", err);
            allProducts = [];
        }

        if (loader) loader.style.display = "none";
        loadSeasonalHighlight();
        renderProducts(allProducts);
    }

    function mapSupabaseCoupon(c) {
        return {
            id: c.id,
            code: c.code,
            active: Boolean(c.is_active),
            is_active: Boolean(c.is_active),
            type: c.discount_type,
            discountType: c.discount_type,
            discount: Number(c.discount_value || 0),
            discount_value: Number(c.discount_value || 0),
            minSpend: Number(c.minimum_order_amount || 0),
            minimum_order_amount: Number(c.minimum_order_amount || 0),
            maxDiscount: c.maximum_discount_amount == null ? null : Number(c.maximum_discount_amount),
            expiry: c.expires_at,
            expires_at: c.expires_at,
            description: c.description
        };
    }

    async function loadCoupons() {
        try {
            if (!window.supabaseClient) {
                throw new Error("Supabase client is not available.");
            }
            const { data, error } = await window.supabaseClient
                .from('coupons')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            activeCoupons = (data || []).map(mapSupabaseCoupon);
        } catch (err) {
            console.error("Failed to load coupons from Supabase:", err);
            activeCoupons = [];
        }
        renderAnnouncementBar();
    }

    // ==========================================
    // 2. ANNOUNCEMENT BAR
    // ==========================================
    function formatCouponAnnouncement(coupon) {
        return `<i class="fa-solid fa-ticket" aria-hidden="true"></i> Special Offer: Use coupon code <strong class="coupon-tag">${escapeHtml(coupon.code)}</strong> for ${escapeHtml(coupon.discount)}% OFF on orders above ₹${escapeHtml(coupon.minSpend)}+`;
    }

    function displayAnnouncementCoupon(index, animate = false) {
        const coupon = announcementCoupons[index];
        if (!coupon || !announcementText) return;

        const updateMessage = () => {
            announcementText.innerHTML = formatCouponAnnouncement(coupon);
            announcementText.classList.remove("is-changing");
        };

        clearTimeout(announcementTransitionTimer);
        if (animate) {
            announcementText.classList.add("is-changing");
            announcementTransitionTimer = setTimeout(updateMessage, 280);
        } else {
            updateMessage();
        }
    }

    function renderAnnouncementBar() {
        if (!announcementText || !announcementBar) return;
        clearInterval(announcementRotationTimer);
        clearTimeout(announcementTransitionTimer);
        announcementCoupons = activeCoupons.filter((coupon) => coupon && coupon.active && coupon.code);
        announcementIndex = 0;

        if (!announcementCoupons.length) {
            announcementText.textContent = "";
            announcementBar.hidden = true;
            return;
        }

        announcementBar.hidden = false;
        displayAnnouncementCoupon(announcementIndex);
        if (announcementCoupons.length > 1) {
            announcementRotationTimer = setInterval(() => {
                announcementIndex = (announcementIndex + 1) % announcementCoupons.length;
                displayAnnouncementCoupon(announcementIndex, true);
            }, 5500);
        }
    }
    // ==========================================
    // PRODUCT IMAGE HELPER (supports variants)
    // ==========================================
    function getPrimaryImage(product) {
        const firstVariant = product.variants && product.variants[0];
        return (firstVariant && (firstVariant.image || (firstVariant.images && firstVariant.images[0]))) || product.image;
    }

    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    // Seasonal content is static while only the selected product imagery rotates.
    async function loadSeasonalHighlight() {
        if (!seasonalHighlightImages) return;
        const defaults = {
            label: 'SEASON HIGHLIGHT', title: 'Curated Artisanal Crafts',
            description: 'Immerse yourself in luxurious textures, vibrant terracotta hues, and intricate embroidery. Every piece tells a story of modern retro style.',
            rotationInterval: 5000, productIds: []
        };
        let settings = defaults;
        try {
            if (!window.supabaseClient) throw new Error('Supabase client is not available.');
            const { data, error } = await window.supabaseClient
                .from('seasonal_highlight')
                .select('label, title, description, rotation_interval, product_ids')
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (data) {
                settings = {
                    ...defaults,
                    label: data.label,
                    title: data.title,
                    description: data.description,
                    rotationInterval: data.rotation_interval,
                    productIds: data.product_ids || []
                };
            }
        } catch (error) {
            console.warn('Seasonal highlight settings unavailable; using catalog defaults.');
        }

        seasonalHighlightLabel.textContent = settings.label || defaults.label;
        seasonalHighlightTitle.textContent = settings.title || defaults.title;
        seasonalHighlightDescription.textContent = settings.description || defaults.description;
        const requestedIds = Array.isArray(settings.productIds) ? settings.productIds.map(String) : [];
        let products = requestedIds.map((id) => allProducts.find((product) => String(product.id) === id)).filter(Boolean);
        if (!products.length) products = allProducts.slice(0, 10);
        products = products.filter((product) => getPrimaryImage(product));

        if (!products.length) {
            seasonalHighlightImages.innerHTML = '';
            if (seasonalHighlightPagination) seasonalHighlightPagination.innerHTML = '';
            return;
        }

        const seasonalSlides = [];
        for (let start = 0; start < products.length; start += 2) {
            seasonalSlides.push([products[start], products[(start + 1) % products.length]]);
        }
        let activeSeasonalSlide = 0;
        let isSeasonalMediaHovered = false;
        const renderPair = () => {
            const pair = seasonalSlides[activeSeasonalSlide];
            seasonalHighlightImages.innerHTML = pair.map((product) => `
                <article class="seasonal-highlight-card is-entering">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}">
                        <img src="${escapeHtml(getPrimaryImage(product))}" alt="" loading="lazy">
                    </a>
                </article>`).join('');
            requestAnimationFrame(() => seasonalHighlightImages.querySelectorAll('.seasonal-highlight-card').forEach((card) => card.classList.remove('is-entering')));
        };
        const updateSeasonalActiveDot = () => {
            seasonalHighlightPagination?.querySelectorAll('.seasonal-highlight-dot').forEach((dot, index) => {
                const isActive = index === activeSeasonalSlide;
                dot.classList.toggle('is-active', isActive);
                dot.setAttribute('aria-current', isActive ? 'true' : 'false');
            });
        };
        const renderSeasonalDots = () => {
            if (!seasonalHighlightPagination) return;
            seasonalHighlightPagination.innerHTML = seasonalSlides.map((_, index) => `<button class="seasonal-highlight-dot${index === activeSeasonalSlide ? ' is-active' : ''}" type="button" aria-label="Show seasonal slide ${index + 1}" aria-current="${index === activeSeasonalSlide ? 'true' : 'false'}"></button>`).join('');
        };

        clearInterval(seasonalHighlightTimer);
        clearTimeout(seasonalHighlightTransitionTimer);
        renderSeasonalDots();
        renderPair();

        const stopSeasonalRotation = () => {
            clearInterval(seasonalHighlightTimer);
            seasonalHighlightTimer = undefined;
        };
        const showNextPair = () => {
            seasonalHighlightImages.querySelectorAll('.seasonal-highlight-card').forEach((card) => card.classList.add('is-leaving'));
            clearTimeout(seasonalHighlightTransitionTimer);
            seasonalHighlightTransitionTimer = setTimeout(() => {
                activeSeasonalSlide = (activeSeasonalSlide + 1) % seasonalSlides.length;
                renderPair();
                updateSeasonalActiveDot();
            }, 280);
        };
        const startSeasonalRotation = () => {
            stopSeasonalRotation();
            if (products.length > 1 && !isSeasonalMediaHovered) {
                seasonalHighlightTimer = setInterval(showNextPair, 5000);
            }
        };

        // Hover behavior is intentionally limited to the image/media area.
        seasonalHighlightImages.onmouseenter = () => {
            isSeasonalMediaHovered = true;
            stopSeasonalRotation();
            clearTimeout(seasonalHighlightTransitionTimer);
            seasonalHighlightTransitionTimer = undefined;
            seasonalHighlightImages.querySelectorAll('.seasonal-highlight-card').forEach((card) => card.classList.remove('is-leaving'));
        };
        seasonalHighlightImages.onmouseleave = () => {
            isSeasonalMediaHovered = false;
            startSeasonalRotation();
        };
        if (seasonalHighlightPagination) {
            seasonalHighlightPagination.onclick = (event) => {
                const dot = event.target.closest('.seasonal-highlight-dot');
                if (!dot) return;
                const slideIndex = [...seasonalHighlightPagination.children].indexOf(dot);
                if (slideIndex < 0) return;
                clearTimeout(seasonalHighlightTransitionTimer);
                activeSeasonalSlide = slideIndex;
                renderPair();
                updateSeasonalActiveDot();
                if (!isSeasonalMediaHovered) startSeasonalRotation();
            };
        }
        startSeasonalRotation();
    }
    // ==========================================
    // 3. RENDER PRODUCTS
    // ==========================================
    function renderProducts(productsToRender) {
        if (!productsGrid) return;
        productsGrid.innerHTML = "";

        if (productsToRender.length === 0) {
            productsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6b635b;">
                    <i class="fa-solid fa-store-slash" style="font-size: 32px; margin-bottom: 10px;"></i>
                    <p>No products found in this category.</p>
                </div>
            `;
            return;
        }

        activeOffers = getStoredData("rj_offers", []);

        productsToRender.forEach(product => {
            const defaultSize = (product.size && product.size.length > 0) ? product.size[0] : "Standard";
            const colors = getProductColors(product);
            const defaultColor = colors[0];
            
            const categoryOffer = activeOffers.find(o => o.active && o.category.toLowerCase() === product.category.toLowerCase());
            let categoryDiscountPct = categoryOffer ? categoryOffer.discount : 0;
            
            let basePrice = product.price;
            let priceAfterCatDiscount = Math.round(basePrice * (1 - categoryDiscountPct / 100));

            let finalPayable = priceAfterCatDiscount;

            if (appliedCoupon && basePrice >= appliedCoupon.minSpend) {
                let couponDiscountAmt = Math.round(priceAfterCatDiscount * (appliedCoupon.discount / 100));
                finalPayable = priceAfterCatDiscount - couponDiscountAmt;
            }

            let sizeOptionsHtml = "";
            if (product.size && product.size.length > 0) {
                sizeOptionsHtml = product.size.map((sz, index) => `
                    <button class="size-btn ${index === 0 ? 'selected' : ''}" data-size="${sz}">${sz}</button>
                `).join("");
            }

            let badgeHtml = "";
            if (categoryOffer) {
                badgeHtml = `<span class="offer-badge">${categoryOffer.discount}% OFF</span>`;
            } else if (appliedCoupon && basePrice >= appliedCoupon.minSpend) {
                badgeHtml = `<span class="offer-badge" style="background:#b45f4d;">${appliedCoupon.code} APPLIED</span>`;
            }

            let priceHtml = `<div class="final-price">₹${finalPayable}</div>`;
            if (finalPayable < basePrice) {
                priceHtml = `
                    <div class="price-container">
                        <span class="original-price">₹${basePrice}</span>
                        <span class="final-price">₹${finalPayable}</span>
                    </div>
                `;
            }

            const card = document.createElement("div");
            card.className = "product-card";
            card.setAttribute("data-id", product.id);
            card.setAttribute("data-selected-size", defaultSize);
            card.setAttribute("data-selected-color", defaultColor.name);
            card.setAttribute("data-selected-image", defaultColor.image);
            card.setAttribute("role", "link");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", `View details for ${product.name}`);

            card.innerHTML = `
                <div class="product-image-box">
                    <span class="category-tag">${product.category}</span>
                    ${badgeHtml}
                    <img src="${defaultColor.image}" alt="${product.name}" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    ${priceHtml}
                    <div class="color-selector"><label>Color:</label><div class="color-options">${colors.map((color, index) => `<button type="button" class="color-swatch ${index === 0 ? "selected" : ""}" data-color="${color.name}" data-image="${color.image}" title="${color.name}" aria-label="${color.name}" style="--swatch-color: ${color.value}; ${String(color.value).startsWith("http") ? `background-image:url('${color.value}')` : ""}"></button>`).join("")}</div><p class="selected-color-text">Selected: ${defaultColor.name}</p></div>
                    
                    <div class="size-selector">
                        <label>Select Size:</label>
                        <div class="size-options">
                            ${sizeOptionsHtml}
                        </div>
                    </div>

                    <div class="product-cart-actions"><button type="button" class="add-to-cart-btn btn-cart"><i class="fa-solid fa-bag-shopping"></i> Add to Cart</button><button type="button" class="whatsapp-order-btn"><i class="fa-brands fa-whatsapp"></i> Checkout</button></div>
                </div>
            `;

            const sizeBtns = card.querySelectorAll(".size-btn");
            sizeBtns.forEach(btn => {
                btn.addEventListener("click", function () {
                    sizeBtns.forEach(b => b.classList.remove("selected"));
                    this.classList.add("selected");
                    card.setAttribute("data-selected-size", this.getAttribute("data-size"));
                });
            });

            const swatches = card.querySelectorAll(".color-swatch");
            swatches.forEach(swatch => swatch.addEventListener("click", function () {
                swatches.forEach(item => item.classList.remove("selected")); this.classList.add("selected");
                card.dataset.selectedColor = this.dataset.color;
                card.dataset.selectedImage = this.dataset.image;
                card.querySelector(".product-image-box img").src = this.dataset.image;
                const selectedColorText = card.querySelector(".selected-color-text");
                if (selectedColorText) selectedColorText.textContent = `Selected: ${this.dataset.color}`;
            }));

            card.querySelector(".add-to-cart-btn").addEventListener("click", () => addToCart(product, card));

            const whatsappBtn = card.querySelector(".whatsapp-order-btn");
            whatsappBtn.addEventListener("click", function (e) {
                e.preventDefault();
                addToCart(product, card);
            });

            const openProductPage = () => {
                window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
            };
            card.addEventListener("click", (event) => {
                if (!event.target.closest(".size-btn, .color-swatch, .add-to-cart-btn, .whatsapp-order-btn")) openProductPage();
            });
            card.addEventListener("keydown", (event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.target.closest(".size-btn, .color-swatch, .add-to-cart-btn, .whatsapp-order-btn")) {
                    event.preventDefault();
                    openProductPage();
                }
            });

            productsGrid.appendChild(card);
        });
        updateCartVisibility();
    }

    // ==========================================
    // 4. COUPON CODE LOGIC
    // ==========================================
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener("click", function () {
            const codeInput = globalCouponInput.value.trim().toUpperCase();
            if (!codeInput) return;

            const foundCoupon = activeCoupons.find(c => c.code.toUpperCase() === codeInput && c.active);

            if (foundCoupon) {
                appliedCoupon = foundCoupon;
                couponMessage.style.color = "#155724";
                couponMessage.innerHTML = `<i class="fa-solid fa-circle-check"></i> Coupon <strong>${foundCoupon.code}</strong> applied (${foundCoupon.discount}% OFF on items above ₹${foundCoupon.minSpend}+)!`;
                removeCouponBtn.style.display = "inline-block";
                renderProducts(allProducts);
            } else {
                appliedCoupon = null;
                couponMessage.style.color = "#8c3d3d";
                couponMessage.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Invalid or inactive coupon code.`;
                removeCouponBtn.style.display = "none";
            }
        });
    }

    if (removeCouponBtn) {
        removeCouponBtn.addEventListener("click", function () {
            appliedCoupon = null;
            globalCouponInput.value = "";
            couponMessage.innerHTML = "";
            removeCouponBtn.style.display = "none";
            renderProducts(allProducts);
        });
    }

    // ==========================================
    // 6. CATEGORY FILTERS
    // ==========================================
    filterButtons.forEach(button => {
        button.addEventListener("click", function () {
            filterButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");

            const selectedCategory = this.getAttribute("data-category");

            if (selectedCategory === "all") {
                renderProducts(allProducts);
            } else {
                const filtered = allProducts.filter(item =>
                    item.category && item.category.toLowerCase() === selectedCategory.toLowerCase()
                );
                renderProducts(filtered);
            }
        });
    });

    // ==========================================
    // 7. ORDER TRACKER MODAL
    // ==========================================
    if (trackOrderHeaderBtn) trackOrderHeaderBtn.addEventListener("click", () => trackerModal.style.display = "flex");
    if (closeModalBtn) closeModalBtn.addEventListener("click", () => trackerModal.style.display = "none");
    window.addEventListener("click", (e) => {
        if (e.target === trackerModal) trackerModal.style.display = "none";
    });

    if (searchOrderBtn) {
        searchOrderBtn.addEventListener("click", async function () {
            const queryId = trackIdInput.value.trim().toUpperCase();
            if (!queryId) return;

            trackResultBox.style.display = "block";
            trackResultBox.innerHTML = '<p style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> Searching order...</p>';

            try {
                if (!window.supabaseClient) throw new Error("Supabase client not available.");
                const { data, error } = await window.supabaseClient
                    .from('orders')
                    .select('*')
                    .eq('order_number', queryId)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    const rawStatus = String(data.status || "pending").toLowerCase();
                    let displayStatus = "Pending";
                    let statusColor = "#856404"; let statusBg = "#fff3cd";

                    if (rawStatus === "confirmed" || rawStatus === "order confirmed") {
                        displayStatus = "Order Confirmed"; statusColor = "#155724"; statusBg = "#d4edda";
                    } else if (rawStatus === "shipped" || rawStatus === "on the way") {
                        displayStatus = "On The Way"; statusColor = "#004085"; statusBg = "#cce5ff";
                    } else if (rawStatus === "delivered") {
                        displayStatus = "Delivered"; statusColor = "#0c5460"; statusBg = "#d1ecf1";
                    } else if (rawStatus === "cancelled") {
                        displayStatus = "Cancelled"; statusColor = "#721c24"; statusBg = "#f8d7da";
                    }

                    const snapshotItems = data.order_snapshot && Array.isArray(data.order_snapshot.items)
                        ? data.order_snapshot.items
                        : null;
                    const itemsText = snapshotItems
                        ? snapshotItems.map((item) => {
                            const name = escapeHtml(item.name || '');
                            const color = escapeHtml(item.color || '');
                            const size = escapeHtml(item.size || '');
                            const qty = escapeHtml(item.qty ?? '');
                            return `${name} (${color}, ${size}) × ${qty}`;
                        }).join(', ')
                        : 'Order details unavailable';
                    const formattedDate = data.placed_at ? new Date(data.placed_at).toLocaleDateString() : (data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A');

                    trackResultBox.innerHTML = `
                        <p><strong>Order ID:</strong> ${escapeHtml(data.order_number)}</p>
                        <p><strong>Product:</strong> ${itemsText}</p>
                        <p><strong>Amount:</strong> ₹${escapeHtml(data.total_amount)}</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p style="margin-top:10px;"><strong>Current Status:</strong>
                            <span style="background:${statusBg}; color:${statusColor}; padding:4px 14px; border-radius:12px; font-weight:700; font-size:13px;">${escapeHtml(displayStatus)}</span>
                        </p>
                    `;
                } else {
                    trackResultBox.innerHTML = `<p style="color:#8c3d3d;"><i class="fa-solid fa-circle-exclamation"></i> No order found for ID <strong>${escapeHtml(queryId)}</strong>.</p>`;
                }
            } catch (err) {
                console.error("Failed to search order in Supabase:", err);
                trackResultBox.innerHTML = `<p style="color:#8c3d3d;"><i class="fa-solid fa-circle-exclamation"></i> Could not check order status right now.</p>`;
            }
        });
    }

    // ==========================================
    // INITIALIZE
    // ==========================================
    async function initApp() {
        renderAuthNavbar();
        renderCart();
        await loadCoupons();
        await loadProducts();
    }
    initApp();
});
