const API_BASE = 'http://127.0.0.1:5000';
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
    const heroAuthBtn = document.getElementById("hero-auth-btn");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const authErrorMsg = document.getElementById("auth-error-msg");
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
    const seasonalHighlightLabel = document.getElementById("seasonal-highlight-label");
    const seasonalHighlightTitle = document.getElementById("seasonal-highlight-title");
    const seasonalHighlightDescription = document.getElementById("seasonal-highlight-description");
    let seasonalHighlightTimer;
    let seasonalHighlightTransitionTimer;

    // ==========================================
    // ADMIN CREDENTIALS (Hardcoded for localStorage mode)
    // ==========================================
    const ADMIN_EMAIL = "admin@rjfashion.com";
    const ADMIN_PASSWORD = "admin123";

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

    function isLoggedIn() {
        return Boolean(localStorage.getItem("rj_user"));
    }

    function guardWhatsAppCheckout(event) {
        if (isLoggedIn()) return true;
        event?.preventDefault();
        const options = {
            icon: "info",
            title: "Login required",
            text: "Please login to continue checkout.",
            confirmButtonText: "Login"
        };
        if (window.Swal) {
            Swal.fire(options).then(() => {
                document.getElementById("login-section")?.scrollIntoView({ behavior: "smooth" });
            });
        } else {
            window.alert(options.text);
        }
        return false;
    }

    // Get registered customers list
    function getRegisteredUsers() {
        return getStoredData("rj_users", []);
    }

    function saveRegisteredUsers(users) {
        saveStoredData("rj_users", users);
    }

    // ==========================================
    // AUTH UI: RENDER NAVBAR BASED ON SESSION
    // ==========================================
    function renderAuthNavbar() {
        const session = getCurrentSession();

        if (!session) {
            // Not logged in — show Login/Register button
            authNavSlot.innerHTML = `
                <button id="open-auth-btn" class="nav-auth-btn">
                    <i class="fa-solid fa-user"></i> Login / Register
                </button>
            `;
            // Re-attach open modal listener
            document.getElementById("open-auth-btn").addEventListener("click", openAuthModal);

            // Update hero button
            if (heroAuthBtn) {
                heroAuthBtn.textContent = "Login Account";
                heroAuthBtn.onclick = openAuthModal;
            }
        } else if (session.role === "admin") {
            // Admin logged in — show Admin Portal link + Logout
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

            if (heroAuthBtn) {
                heroAuthBtn.textContent = "Admin Portal";
                heroAuthBtn.onclick = function () { window.location.href = "admin.html"; };
            }
        } else {
            // Customer logged in — show name + Logout
            authNavSlot.innerHTML = `
                <div class="nav-user-box">
                    <span class="user-badge"><i class="fa-solid fa-user-check"></i> ${session.name}</span>
                    <button id="logout-btn" class="nav-auth-btn" style="font-size: 12px;">
                        <i class="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
                </div>
            `;
            document.getElementById("logout-btn").addEventListener("click", handleLogout);

            if (heroAuthBtn) {
                heroAuthBtn.textContent = `Hi, ${session.name.split(" ")[0]}!`;
                heroAuthBtn.onclick = function () {
                    document.getElementById("products-section").scrollIntoView({ behavior: "smooth" });
                };
            }
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
        showLoginTab();
    }

    function closeAuthModal() {
        if (authModal) authModal.style.display = "none";
        hideAuthError();
    }

    function showLoginTab() {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        loginForm.style.display = "block";
        registerForm.style.display = "none";
        hideAuthError();
    }

    function showRegisterTab() {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        registerForm.style.display = "block";
        loginForm.style.display = "none";
        hideAuthError();
    }

    function showAuthError(msg) {
        authErrorMsg.style.display = "block";
        authErrorMsg.textContent = msg;
    }

    function hideAuthError() {
        authErrorMsg.style.display = "none";
        authErrorMsg.textContent = "";
    }

    // Wire up modal controls
    if (openAuthBtn) openAuthBtn.addEventListener("click", openAuthModal);
    if (heroAuthBtn) heroAuthBtn.onclick = openAuthModal;
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener("click", closeAuthModal);
    if (tabLogin) tabLogin.addEventListener("click", showLoginTab);
    if (tabRegister) tabRegister.addEventListener("click", showRegisterTab);

    // Close modal on background click
    if (authModal) {
        authModal.addEventListener("click", function (e) {
            if (e.target === authModal) closeAuthModal();
        });
    }

    // ==========================================
    // LOGIN FORM HANDLER
    // ==========================================
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const emailInput = document.getElementById("login-email").value.trim().toLowerCase();
            const passwordInput = document.getElementById("login-password").value;

            // Check Admin Credentials
            if (emailInput === ADMIN_EMAIL && passwordInput === ADMIN_PASSWORD) {
                saveSession({
                    name: "Admin",
                    email: ADMIN_EMAIL,
                    role: "admin",
                    loggedInAt: new Date().toISOString()
                });
                closeAuthModal();
                renderAuthNavbar();
                // Redirect to Admin Portal
                window.location.href = "admin.html";
                return;
            }

            // Check Customer Credentials
            const users = getRegisteredUsers();
            const matchedUser = users.find(
                u => u.email.toLowerCase() === emailInput && u.password === passwordInput
            );

            if (matchedUser) {
                saveSession({
                    name: matchedUser.name,
                    email: matchedUser.email,
                    role: "customer",
                    loggedInAt: new Date().toISOString()
                });
                closeAuthModal();
                renderAuthNavbar();
                Swal.fire({
                    icon: "success",
                    title: `Welcome, ${matchedUser.name}!`,
                    text: "You have successfully logged in.",
                    confirmButtonColor: "#8c3d3d"
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Login failed",
                    text: "Invalid email or password.",
                    confirmButtonColor: "#8c3d3d"
                });
            }
        });
    }

    // ==========================================
    // REGISTER FORM HANDLER
    // ==========================================
    if (registerForm) {
        registerForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const name = document.getElementById("reg-name").value.trim();
            const email = document.getElementById("reg-email").value.trim().toLowerCase();
            const password = document.getElementById("reg-password").value;

            if (!name || !email || !password) {
                showAuthError("Please fill in all required fields.");
                return;
            }

            if (password.length < 6) {
                showAuthError("Password must be at least 6 characters.");
                return;
            }

            // Check if email already registered
            const users = getRegisteredUsers();
            const exists = users.find(u => u.email.toLowerCase() === email);

            if (exists) {
                showAuthError("This email is already registered. Please log in instead.");
                return;
            }

            // Save new user
            users.push({
                name: name,
                email: email,
                password: password,
                registeredAt: new Date().toISOString()
            });
            saveRegisteredUsers(users);

            // Auto-login after registration
            saveSession({
                name: name,
                email: email,
                role: "customer",
                loggedInAt: new Date().toISOString()
            });

            closeAuthModal();
            renderAuthNavbar();
            Swal.fire({
                icon: "success",
                title: "Account created",
                text: `Welcome to RJ Ladies Fashion, ${name}!`,
                confirmButtonColor: "#8c3d3d"
            });
        });
    }

    

    // ==========================================
    // STATE VARIABLES
    // ==========================================
    let allProducts = getStoredData("rj_products", []);
    let activeCoupons = getStoredData("rj_coupons", []);
    let activeOffers = getStoredData("rj_offers", []);
    let allOrders = getStoredData("rj_orders", []);
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
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
        let discount = 0;
        if (cartCoupon && subtotal >= Number(cartCoupon.minSpend || 0)) {
            discount = String(cartCoupon.discountType || cartCoupon.type || "").toLowerCase() === "fixed"
                ? Number(cartCoupon.discount || 0)
                : subtotal * (Number(cartCoupon.discount || 0) / 100);
            discount = Math.min(discount, subtotal);
        }
        return { subtotal, discount: Math.round(discount), total: Math.max(0, Math.round(subtotal - discount)) };
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
        else cart.push({ productId: product.id, name: product.name, price: Number(product.price), image, color, size, qty: 1 });
        saveCart(); openCart();
    }

    function updateCartVisibility() {
        const loggedIn = isLoggedIn();
        if (headerCart) headerCart.style.display = loggedIn ? "flex" : "none";
        if (cartToggleBtn) cartToggleBtn.hidden = !loggedIn;
        document.querySelectorAll(".btn-cart").forEach(button => { button.hidden = !loggedIn; });
        if (!loggedIn) closeCart();
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
        const code = String(cartCouponInput?.value || "").trim().toLowerCase();
        const coupon = getStoredData("rj_coupons", []).find(item => String(item.code || "").trim().toLowerCase() === code && item.active && (!item.expiryDate && !item.expiry || new Date(`${item.expiryDate || item.expiry}T23:59:59`) >= new Date()));
        if (!coupon) { cartCoupon = null; cartCouponMessage.textContent = "Enter a valid active coupon that has not expired."; cartCouponMessage.className = "cart-coupon-message error"; renderCart(); return; }
        if (getCartTotals().subtotal < Number(coupon.minSpend || 0)) { cartCoupon = null; cartCouponMessage.textContent = `This coupon requires a minimum order of ₹${coupon.minSpend}.`; cartCouponMessage.className = "cart-coupon-message error"; renderCart(); return; }
        cartCoupon = coupon; cartCouponMessage.textContent = `${coupon.code} applied.`; cartCouponMessage.className = "cart-coupon-message success"; renderCart();
    });
    cartCheckoutBtn?.addEventListener("click", () => {
        if (!guardWhatsAppCheckout()) return;
        if (!cart.length) return;
        const session = getCurrentSession(); const totals = getCartTotals(); const orderRef = `RJ-${Math.floor(1000 + Math.random() * 9000)}`;
        const lines = cart.map(item => `• ${item.name} — ${item.color}, ${item.size} × ${item.qty}: ₹${Number(item.price) * item.qty}`).join("\n");
        const couponLine = cartCoupon ? `\nCoupon: ${cartCoupon.code}\nDiscount: ₹${totals.discount}` : "";
        const message = `Hi RJ Ladies Fashion! I would like to place an order.\n\nOrder Ref: ${orderRef}\nCustomer: ${session?.name || "Guest Customer"}\n\nItems:\n${lines}\n\nSubtotal: ₹${totals.subtotal}${couponLine}\nFinal Total: ₹${totals.total}\n\nPlease confirm my order and share delivery details!`;
        allOrders = getStoredData("rj_orders", []); allOrders.unshift({ id: orderRef, customerName: session?.name || "Guest Customer", phone: "", product: cart.map(item => item.name).join(", "), size: "Cart order", amount: totals.total, status: "Order Confirmed", date: new Date().toISOString().split("T")[0] }); saveStoredData("rj_orders", allOrders);
        window.open(`https://wa.me/919567308831?text=${encodeURIComponent(message)}`, "_blank");
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
    // 1. LOAD PRODUCTS
    // ==========================================
    async function loadProducts() {
        if (loader) loader.style.display = "flex";

        // Always fetch latest products from Flask API
        try {
            const response = await fetch(`${API_BASE}/api/products`);

            if (response.ok) {
                allProducts = await response.json();
            } else {
                console.warn("API failed, using fallback catalog.");
                allProducts = getFallbackCatalog();
            }
        } catch (err) {
            console.warn("fetch() failed, using fallback catalog.");
            allProducts = getFallbackCatalog();
        }

        if (loader) loader.style.display = "none";
        renderAnnouncementBar();
        loadSeasonalHighlight();
        renderProducts(allProducts);
    }

    function getFallbackCatalog() {
        return [
            { "id": 1001, "name": "Cream Floral Top", "price": 799, "category": "tops", "size": ["S", "M", "L"], "image": "images/tops/top-01.jpg" },
            { "id": 1002, "name": "Terracotta Top", "price": 899, "category": "tops", "size": ["S", "M", "L"], "image": "images/tops/top-02.jpg" },
            { "id": 1003, "name": "Embroidered Top", "price": 999, "category": "tops", "size": ["S", "M", "L"], "image": "images/tops/top-03.jpg" },
            { "id": 1004, "name": "Minimal Linen Top", "price": 749, "category": "tops", "size": ["S", "M", "L"], "image": "images/tops/top-04.jpg" },
            { "id": 1005, "name": "Floral Kurti", "price": 1299, "category": "kurtis", "size": ["S", "M", "L", "XL"], "image": "images/kurtis/kurti-01.jpg" },
            { "id": 1006, "name": "Cotton Kurti", "price": 1499, "category": "kurtis", "size": ["S", "M", "L", "XL"], "image": "images/kurtis/kurti-02.jpg" },
            { "id": 1007, "name": "Traditional Terracotta Kurti", "price": 1399, "category": "kurtis", "size": ["S", "M", "L", "XL"], "image": "images/kurtis/kurti-03.jpg" },
            { "id": 1008, "name": "Modern Minimalist Kurti", "price": 1199, "category": "kurtis", "size": ["S", "M", "L", "XL"], "image": "images/kurtis/kurti-04.jpg" },
            { "id": 1009, "name": "Premium Silk Saree", "price": 2499, "category": "sarees", "size": ["Free Size"], "image": "images/sarees/saree-01.jpg" },
            { "id": 1010, "name": "Printed Saree", "price": 1899, "category": "sarees", "size": ["Free Size"], "image": "images/sarees/saree-02.jpg" },
            { "id": 1011, "name": "Elegant Cotton Saree", "price": 1699, "category": "sarees", "size": ["Free Size"], "image": "images/sarees/saree-03.jpg" },
            { "id": 1012, "name": "Premium Party-Wear Saree", "price": 2999, "category": "sarees", "size": ["Free Size"], "image": "images/sarees/saree-04.jpg" },
            { "id": 1013, "name": "Premium Handbag", "price": 1599, "category": "accessories", "size": ["Standard"], "image": "images/accessories/accessory-01.jpg" },
            { "id": 1014, "name": "Elegant Jewellery Collection", "price": 1999, "category": "accessories", "size": ["Standard"], "image": "images/accessories/accessory-02.jpg" }
        ];
    }

    // ==========================================
    // 2. ANNOUNCEMENT BAR
    // ==========================================
    function renderAnnouncementBar() {
        if (!announcementText) return;
        activeCoupons = getStoredData("rj_coupons", []);
        activeOffers = getStoredData("rj_offers", []);

        const validCoupon = activeCoupons.find(c => c.active);
        const validOffer = activeOffers.find(o => o.active);

        if (validCoupon) {
            announcementText.innerHTML = `<i class="fa-solid fa-bullhorn"></i> Special Offer: Use code <strong class="coupon-tag">${validCoupon.code}</strong> for ${validCoupon.discount}% OFF on orders above ₹${validCoupon.minSpend}+!`;
        } else if (validOffer) {
            announcementText.innerHTML = `<i class="fa-solid fa-fire"></i> ${validOffer.bannerText}`;
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
            const response = await fetch(`${API_BASE}/api/seasonal-highlight`);
            if (response.ok) settings = { ...defaults, ...await response.json() };
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
            return;
        }

        let position = 0;
        let isSeasonalMediaHovered = false;
        const renderPair = () => {
            const pair = [products[position], products[(position + 1) % products.length]];
            seasonalHighlightImages.innerHTML = pair.map((product) => `
                <article class="seasonal-highlight-card is-entering">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}">
                        <img src="${escapeHtml(getPrimaryImage(product))}" alt="" loading="lazy">
                    </a>
                </article>`).join('');
            requestAnimationFrame(() => seasonalHighlightImages.querySelectorAll('.seasonal-highlight-card').forEach((card) => card.classList.remove('is-entering')));
        };

        clearInterval(seasonalHighlightTimer);
        clearTimeout(seasonalHighlightTransitionTimer);
        renderPair();

        const stopSeasonalRotation = () => {
            clearInterval(seasonalHighlightTimer);
            seasonalHighlightTimer = undefined;
        };
        const showNextPair = () => {
            seasonalHighlightImages.querySelectorAll('.seasonal-highlight-card').forEach((card) => card.classList.add('is-leaving'));
            clearTimeout(seasonalHighlightTransitionTimer);
            seasonalHighlightTransitionTimer = setTimeout(() => {
                position = (position + 2) % products.length;
                renderPair();
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
                if (!guardWhatsAppCheckout(e)) return;
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

            activeCoupons = getStoredData("rj_coupons", []);
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
                couponMessage.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Invalid or inactive coupon code. Try <strong>RJ799</strong>.`;
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
    // 5. WHATSAPP CHECKOUT + ORDER SAVE
    // ==========================================
    function processWhatsAppCheckout(product, selectedSize, basePrice, finalPayable, categoryDiscountPct) {
        const session = getCurrentSession();
        const customerName = session ? session.name : "Guest Customer";

        const orderRef = "RJ-" + Math.floor(1000 + Math.random() * 9000);

        let couponNote = "";
        if (appliedCoupon && basePrice >= appliedCoupon.minSpend) {
            couponNote = `\n🎟️ *Applied Coupon:* ${appliedCoupon.code} (${appliedCoupon.discount}% OFF)`;
        } else if (categoryDiscountPct > 0) {
            couponNote = `\n🔥 *Category Offer:* ${categoryDiscountPct}% OFF Applied`;
        }

        const messageText = `Hi RJ Ladies Fashion! I would like to place an order:\n\n📦 *Order Ref:* ${orderRef}\n👤 *Customer:* ${customerName}\n🛍️ *Product:* ${product.name}\n📏 *Size:* ${selectedSize}\n🏷️ *Original Price:* ₹${basePrice}${couponNote}\n💰 *Final Payable Amount:* ₹${finalPayable}\n\nPlease confirm my order and share delivery details!`;

        const newOrder = {
            id: orderRef,
            customerName: customerName,
            phone: "",
            product: product.name,
            size: selectedSize,
            amount: finalPayable,
            status: "Order Confirmed",
            date: new Date().toISOString().split('T')[0]
        };

        allOrders = getStoredData("rj_orders", []);
        allOrders.unshift(newOrder);
        saveStoredData("rj_orders", allOrders);

        const shopNumber = "919567308831";
        const whatsappUrl =
            `https://wa.me/${shopNumber}?text=${encodeURIComponent(messageText)}`;
        window.open(whatsappUrl, "_blank");
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
        searchOrderBtn.addEventListener("click", function () {
            const queryId = trackIdInput.value.trim().toUpperCase();
            if (!queryId) return;

            allOrders = getStoredData("rj_orders", []);
            const found = allOrders.find(o => o.id.toUpperCase() === queryId);

            trackResultBox.style.display = "block";
            if (found) {
                let statusColor = "#856404"; let statusBg = "#fff3cd";
                if (found.status === "Order Confirmed") { statusColor = "#155724"; statusBg = "#d4edda"; }
                if (found.status === "On The Way") { statusColor = "#004085"; statusBg = "#cce5ff"; }
                if (found.status === "Delivered") { statusColor = "#0c5460"; statusBg = "#d1ecf1"; }

                trackResultBox.innerHTML = `
                    <p><strong>Order ID:</strong> ${found.id}</p>
                    <p><strong>Customer:</strong> ${found.customerName}</p>
                    <p><strong>Product:</strong> ${found.product} (${found.size})</p>
                    <p><strong>Amount:</strong> ₹${found.amount}</p>
                    <p><strong>Date:</strong> ${found.date}</p>
                    <p style="margin-top:10px;"><strong>Current Status:</strong>
                        <span style="background:${statusBg}; color:${statusColor}; padding:4px 14px; border-radius:12px; font-weight:700; font-size:13px;">${found.status}</span>
                    </p>
                `;
            } else {
                trackResultBox.innerHTML = `<p style="color:#8c3d3d;"><i class="fa-solid fa-circle-exclamation"></i> No order found for ID <strong>${queryId}</strong>. Try sample ID <strong>RJ-8091</strong>.</p>`;
            }
        });
    }

    // ==========================================
    // INITIALIZE
    // ==========================================
    renderAuthNavbar();
    renderCart();
    loadProducts();
});
