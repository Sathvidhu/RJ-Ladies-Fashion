const RJ_WHATSAPP_NUMBER = '919567308831';
const RJ_CART_KEY = 'rj_cart';

function rjEscapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
}

function mapStoreCoupon(coupon) {
    if (!coupon) return null;
    const type = String(coupon.discount_type || coupon.discountType || coupon.type || 'percentage').toLowerCase();
    return {
        id: coupon.id || null,
        code: String(coupon.code || '').trim(),
        active: coupon.active !== false && coupon.is_active !== false,
        type,
        discountType: type,
        discount: Number(coupon.discount_value ?? coupon.discount ?? 0),
        minSpend: Number(coupon.minimum_order_amount ?? coupon.minSpend ?? 0),
        maxDiscount: coupon.maximum_discount_amount == null && coupon.maxDiscount == null
            ? null
            : Number(coupon.maximum_discount_amount ?? coupon.maxDiscount),
        expires_at: coupon.expires_at || coupon.expiry || coupon.expiryDate || null,
        starts_at: coupon.starts_at || null,
        description: coupon.description || ''
    };
}

function isCouponCurrentlyValid(coupon) {
    if (!coupon || !coupon.code || coupon.active === false) return false;
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) return false;
    if (coupon.expires_at) {
        const expiry = String(coupon.expires_at).length <= 10
            ? new Date(`${coupon.expires_at}T23:59:59`)
            : new Date(coupon.expires_at);
        if (expiry < now) return false;
    }
    return true;
}

function calculateGuestTotals(items, coupon) {
    const safeItems = Array.isArray(items) ? items : [];
    const subtotal = Math.round(safeItems.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (Number(item.qty) || 0);
    }, 0));
    const mapped = mapStoreCoupon(coupon);
    let discount = 0;
    if (mapped && isCouponCurrentlyValid(mapped) && subtotal >= mapped.minSpend) {
        discount = mapped.type === 'fixed'
            ? mapped.discount
            : subtotal * (mapped.discount / 100);
        if (mapped.maxDiscount != null && !Number.isNaN(mapped.maxDiscount)) {
            discount = Math.min(discount, mapped.maxDiscount);
        }
        discount = Math.min(Math.round(discount), subtotal);
    }
    return {
        subtotal,
        discount,
        shippingLabel: 'To be confirmed',
        total: Math.max(0, subtotal - discount)
    };
}

function normalizeCheckoutItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => {
        const qty = Number(item.qty || item.quantity || 0);
        const price = Number(item.price || 0);
        const color = item.color || 'Default';
        const size = item.size || 'Standard';
        const variant = item.variant || item.variant_label || color;
        return {
            productId: item.productId || item.id || null,
            variantId: item.variantId || item.variant_id || null,
            name: item.name || 'Untitled Product',
            image: item.image || '',
            color,
            size,
            variant,
            qty,
            price,
            lineTotal: price * qty
        };
    });
}

function isValidWhatsAppNumber(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return true;
    if (digits.length === 12 && digits.startsWith('91')) return true;
    if (digits.length === 11 && digits.startsWith('0')) return true;
    return false;
}

function isValidPincode(value) {
    return /^\d{6}$/.test(String(value || '').trim());
}

function buildWhatsAppMessage({ orderRef, details, items, totals, coupon }) {
    const itemLines = items.map((item) =>
        `• ${item.name} — ${item.color}, ${item.size} × ${item.qty}: ₹${item.lineTotal}`
    ).join('\n');
    const couponLines = coupon && coupon.code
        ? `\n*Coupon:* ${coupon.code}\n*Discount:* ₹${totals.discount}`
        : (totals.discount > 0 ? `\n*Discount:* ₹${totals.discount}` : '');

    return `Hi RJ Ladies Fashion! I would like to place an order.

*Order Ref:* ${orderRef}

*Customer:* ${details.customer_name}
*WhatsApp:* ${details.whatsapp_number}

*Delivery Address:*
House/Flat: ${details.house_flat}
Street/Area: ${details.street_area}
City: ${details.city}
District: ${details.district}
State: ${details.state}
Pincode: ${details.pincode}

*Items:*
${itemLines}

*Subtotal:* ₹${totals.subtotal}${couponLines}
*Shipping:* To be confirmed
*Final Total:* ₹${totals.total}

Please confirm my order and share delivery/payment details!`;
}

async function generateUniqueOrderRef() {
    const client = window.supabaseClient;
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const ref = `RJ-${Math.floor(1000 + Math.random() * 9000)}`;
        if (!client) return ref;
        try {
            const { data, error } = await client
                .from('whatsapp_order_requests')
                .select('order_ref')
                .eq('order_ref', ref)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') {
                return ref;
            }
            if (!data) return ref;
        } catch (error) {
            return ref;
        }
    }
    return `RJ-${String(Date.now()).slice(-4)}`;
}

async function saveWhatsAppOrderRequest(payload) {
    if (!window.supabaseClient) {
        throw new Error('Supabase client is not available.');
    }

    const { error } = await window.supabaseClient
        .from('whatsapp_order_requests')
        .insert(payload);
    if (error) throw error;
    return true;
}

function checkoutMarkup() {
    return `
    <div id="guest-checkout-overlay" class="checkout-overlay" hidden>
        <div class="checkout-card" role="dialog" aria-modal="true" aria-labelledby="guest-checkout-title">
            <button type="button" class="checkout-close" id="guest-checkout-close" aria-label="Close checkout"><i class="fa-solid fa-xmark"></i></button>
            <h2 id="guest-checkout-title">Guest Checkout</h2>
            <p class="checkout-lead">Enter your details and place a WhatsApp order request. Your order is confirmed only after we reply.</p>
            <p id="guest-checkout-error" class="checkout-error" role="alert"></p>
            <div class="checkout-grid">
                <form id="guest-checkout-form" class="checkout-section">
                    <h3>Customer &amp; Delivery Details</h3>
                    <div class="checkout-fields">
                        <div class="form-group span-2">
                            <label for="co-name">Full Name *</label>
                            <input id="co-name" class="form-control" name="customer_name" autocomplete="name" required>
                        </div>
                        <div class="form-group span-2">
                            <label for="co-whatsapp">WhatsApp Number *</label>
                            <input id="co-whatsapp" class="form-control" name="whatsapp_number" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number" required>
                        </div>
                        <div class="form-group">
                            <label for="co-house">House / Flat No. *</label>
                            <input id="co-house" class="form-control" name="house_flat" required>
                        </div>
                        <div class="form-group">
                            <label for="co-street">Street / Area *</label>
                            <input id="co-street" class="form-control" name="street_area" required>
                        </div>
                        <div class="form-group">
                            <label for="co-city">City *</label>
                            <input id="co-city" class="form-control" name="city" required>
                        </div>
                        <div class="form-group">
                            <label for="co-district">District *</label>
                            <input id="co-district" class="form-control" name="district" required>
                        </div>
                        <div class="form-group">
                            <label for="co-state">State *</label>
                            <input id="co-state" class="form-control" name="state" required>
                        </div>
                        <div class="form-group">
                            <label for="co-pincode">Pincode *</label>
                            <input id="co-pincode" class="form-control" name="pincode" inputmode="numeric" maxlength="6" required>
                        </div>
                    </div>
                    <button type="submit" class="checkout-submit" id="guest-checkout-submit"><i class="fa-brands fa-whatsapp"></i> Order Now</button>
                </form>
                <aside class="checkout-section">
                    <h3>Order Summary</h3>
                    <div id="guest-checkout-items" class="checkout-items"></div>
                    <h3>Active Coupons</h3>
                    <div class="checkout-apply-row">
                        <input id="guest-checkout-coupon-input" type="text" placeholder="Enter coupon code">
                        <button type="button" id="guest-checkout-coupon-apply">Apply</button>
                    </div>
                    <p id="guest-checkout-coupon-note" class="checkout-coupon-note"></p>
                    <div id="guest-checkout-coupons" class="checkout-coupons"></div>
                    <div class="checkout-totals">
                        <p><span>Subtotal</span><strong id="co-subtotal">₹0</strong></p>
                        <p><span>Discount</span><strong id="co-discount">₹0</strong></p>
                        <p><span>Shipping</span><strong>To be confirmed</strong></p>
                        <p class="grand"><span>Final Total</span><strong id="co-total">₹0</strong></p>
                    </div>
                </aside>
            </div>
        </div>
    </div>`;
}

const checkoutState = {
    items: [],
    coupons: [],
    appliedCoupon: null,
    onAppliedCoupon: null
};

function ensureCheckoutModal() {
    if (document.getElementById('guest-checkout-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', checkoutMarkup());
    document.getElementById('guest-checkout-close').addEventListener('click', closeGuestCheckout);
    document.getElementById('guest-checkout-overlay').addEventListener('click', (event) => {
        if (event.target.id === 'guest-checkout-overlay') closeGuestCheckout();
    });
    document.getElementById('guest-checkout-form').addEventListener('submit', submitGuestCheckout);
    document.getElementById('guest-checkout-coupon-apply').addEventListener('click', () => {
        applyCheckoutCoupon(document.getElementById('guest-checkout-coupon-input').value);
    });
}

function showCheckoutError(message) {
    const box = document.getElementById('guest-checkout-error');
    if (!box) return;
    box.textContent = message || '';
    box.classList.toggle('is-visible', Boolean(message));
}

function renderCheckoutItems() {
    const wrap = document.getElementById('guest-checkout-items');
    if (!wrap) return;
    if (!checkoutState.items.length) {
        wrap.innerHTML = '<p class="checkout-empty">Your bag is empty.</p>';
        return;
    }
    wrap.innerHTML = checkoutState.items.map((item) => `
        <article class="checkout-item">
            <img src="${rjEscapeHtml(item.image)}" alt="${rjEscapeHtml(item.name)}">
            <div>
                <strong>${rjEscapeHtml(item.name)}</strong>
                <small>Color: ${rjEscapeHtml(item.color)}</small><br>
                <small>Size: ${rjEscapeHtml(item.size)}</small><br>
                <small>Variant: ${rjEscapeHtml(item.variant)}</small><br>
                <small>Qty: ${rjEscapeHtml(item.qty)} · Unit: ₹${rjEscapeHtml(item.price)}</small>
            </div>
            <span class="line-total">₹${rjEscapeHtml(item.lineTotal)}</span>
        </article>
    `).join('');
}

function renderCheckoutCoupons() {
    const wrap = document.getElementById('guest-checkout-coupons');
    if (!wrap) return;
    const totals = calculateGuestTotals(checkoutState.items, null);
    const active = checkoutState.coupons.filter(isCouponCurrentlyValid);
    if (!active.length) {
        wrap.innerHTML = '<p class="checkout-empty">No active coupons right now.</p>';
        return;
    }
    wrap.innerHTML = active.map((coupon) => {
        const eligible = totals.subtotal >= coupon.minSpend;
        const applied = checkoutState.appliedCoupon && checkoutState.appliedCoupon.code.toLowerCase() === coupon.code.toLowerCase();
        const discountLabel = coupon.type === 'fixed' ? `₹${coupon.discount} OFF` : `${coupon.discount}% OFF`;
        const maxLabel = coupon.maxDiscount != null ? ` · Max ₹${coupon.maxDiscount}` : '';
        return `
            <article class="checkout-coupon${applied ? ' is-applied' : ''}">
                <p>
                    <strong>${rjEscapeHtml(coupon.code)}</strong>
                    ${rjEscapeHtml(discountLabel)}${rjEscapeHtml(maxLabel)}<br>
                    Min. order ₹${rjEscapeHtml(coupon.minSpend)}
                    ${applied ? '<br>Applied' : ''}
                </p>
                <button type="button" data-apply-coupon="${rjEscapeHtml(coupon.code)}" ${eligible ? '' : 'disabled'}>
                    ${applied ? 'Applied' : eligible ? 'Apply' : 'Min. not met'}
                </button>
            </article>`;
    }).join('');
    wrap.querySelectorAll('[data-apply-coupon]').forEach((button) => {
        button.addEventListener('click', () => applyCheckoutCoupon(button.dataset.applyCoupon));
    });
}

function renderCheckoutTotals() {
    const totals = calculateGuestTotals(checkoutState.items, checkoutState.appliedCoupon);
    const subtotalEl = document.getElementById('co-subtotal');
    const discountEl = document.getElementById('co-discount');
    const totalEl = document.getElementById('co-total');
    if (subtotalEl) subtotalEl.textContent = `₹${totals.subtotal}`;
    if (discountEl) discountEl.textContent = `₹${totals.discount}`;
    if (totalEl) totalEl.textContent = `₹${totals.total}`;
}

function applyCheckoutCoupon(code) {
    const note = document.getElementById('guest-checkout-coupon-note');
    const entered = String(code || '').trim();
    if (!entered) {
        checkoutState.appliedCoupon = null;
        if (note) {
            note.textContent = 'Enter a coupon code.';
            note.className = 'checkout-coupon-note error';
        }
        renderCheckoutCoupons();
        renderCheckoutTotals();
        if (typeof checkoutState.onAppliedCoupon === 'function') checkoutState.onAppliedCoupon(null);
        return false;
    }
    const coupon = checkoutState.coupons
        .map(mapStoreCoupon)
        .find((item) => item.code.toLowerCase() === entered.toLowerCase());
    const subtotal = calculateGuestTotals(checkoutState.items, null).subtotal;
    if (!coupon || !isCouponCurrentlyValid(coupon)) {
        checkoutState.appliedCoupon = null;
        if (note) {
            note.textContent = 'Enter a valid active coupon that has not expired.';
            note.className = 'checkout-coupon-note error';
        }
        renderCheckoutCoupons();
        renderCheckoutTotals();
        if (typeof checkoutState.onAppliedCoupon === 'function') checkoutState.onAppliedCoupon(null);
        return false;
    }
    if (subtotal < coupon.minSpend) {
        checkoutState.appliedCoupon = null;
        if (note) {
            note.textContent = `This coupon requires a minimum order of ₹${coupon.minSpend}.`;
            note.className = 'checkout-coupon-note error';
        }
        renderCheckoutCoupons();
        renderCheckoutTotals();
        if (typeof checkoutState.onAppliedCoupon === 'function') checkoutState.onAppliedCoupon(null);
        return false;
    }
    checkoutState.appliedCoupon = coupon;
    if (note) {
        note.textContent = `${coupon.code} applied.`;
        note.className = 'checkout-coupon-note success';
    }
    const input = document.getElementById('guest-checkout-coupon-input');
    if (input) input.value = coupon.code;
    renderCheckoutCoupons();
    renderCheckoutTotals();
    if (typeof checkoutState.onAppliedCoupon === 'function') checkoutState.onAppliedCoupon(coupon);
    return true;
}

function readCheckoutDetails() {
    const form = document.getElementById('guest-checkout-form');
    const data = new FormData(form);
    return {
        customer_name: String(data.get('customer_name') || '').trim(),
        whatsapp_number: String(data.get('whatsapp_number') || '').trim(),
        house_flat: String(data.get('house_flat') || '').trim(),
        street_area: String(data.get('street_area') || '').trim(),
        city: String(data.get('city') || '').trim(),
        district: String(data.get('district') || '').trim(),
        state: String(data.get('state') || '').trim(),
        pincode: String(data.get('pincode') || '').trim()
    };
}

function validateCheckout(details, items, coupon) {
    if (!items.length) return 'Your bag is empty.';
    if (items.some((item) => !(Number(item.qty) > 0))) return 'Each item quantity must be greater than 0.';
    if (!details.customer_name) return 'Please enter your full name.';
    if (!details.whatsapp_number || !isValidWhatsAppNumber(details.whatsapp_number)) {
        return 'Please enter a valid WhatsApp number.';
    }
    if (!details.house_flat) return 'Please enter House / Flat No.';
    if (!details.street_area) return 'Please enter Street / Area.';
    if (!details.city) return 'Please enter City.';
    if (!details.district) return 'Please enter District.';
    if (!details.state) return 'Please enter State.';
    if (!details.pincode || !isValidPincode(details.pincode)) return 'Please enter a valid 6-digit pincode.';
    if (coupon) {
        const mapped = mapStoreCoupon(coupon);
        const subtotal = calculateGuestTotals(items, null).subtotal;
        if (!isCouponCurrentlyValid(mapped) || subtotal < mapped.minSpend) {
            return 'The selected coupon is not valid for this order.';
        }
    }
    return '';
}

async function submitGuestCheckout(event) {
    event.preventDefault();
    showCheckoutError('');
    const items = normalizeCheckoutItems(checkoutState.items);
    const details = readCheckoutDetails();
    const coupon = checkoutState.appliedCoupon;
    const validationError = validateCheckout(details, items, coupon);
    if (validationError) {
        showCheckoutError(validationError);
        return;
    }

    const submitBtn = document.getElementById('guest-checkout-submit');
    submitBtn.disabled = true;
    const orderRef = await generateUniqueOrderRef();
    const totals = calculateGuestTotals(items, coupon);
    const snapshot = {
        order_ref: orderRef,
        customer: details,
        items,
        totals: {
            subtotal: totals.subtotal,
            discount_amount: totals.discount,
            shipping: 'To be confirmed',
            final_total: totals.total
        },
        coupon: coupon ? { id: coupon.id, code: coupon.code, discount: coupon.discount, type: coupon.type } : null
    };

    const payload = {
        order_ref: orderRef,
        customer_name: details.customer_name,
        whatsapp_number: details.whatsapp_number,
        house_flat: details.house_flat,
        street_area: details.street_area,
        city: details.city,
        district: details.district,
        state: details.state,
        pincode: details.pincode,
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        shipping_amount: null,
        coupon_id: coupon && /^[0-9a-f-]{36}$/i.test(String(coupon.id || '')) ? coupon.id : null,
        coupon_code: coupon && coupon.code ? coupon.code : null,
        final_total: totals.total,
        status: 'pending_whatsapp',
        order_snapshot: snapshot
    };

    try {
        let saved = false;
        let currentRef = orderRef;
        for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
            payload.order_ref = currentRef;
            payload.order_snapshot = { ...snapshot, order_ref: currentRef };
            try {
                await saveWhatsAppOrderRequest(payload);
                saved = true;
                window.RJCheckout.writeCart([]);
            } catch (error) {
                const message = String(error.message || error.details || error.code || '');
                if (/duplicate|unique|23505/i.test(message) && attempt < 4) {
                    currentRef = await generateUniqueOrderRef();
                    continue;
                }
                throw error;
            }
        }
        if (!saved) throw new Error('Unable to save WhatsApp order request.');
        const message = buildWhatsAppMessage({
            orderRef: payload.order_ref,
            details,
            items,
            totals,
            coupon
        });
        window.open(`https://wa.me/${RJ_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
        closeGuestCheckout();
        const text = 'WhatsApp is opening with your order request. Please tap Send to share it. Your order is not confirmed until we reply.';
        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: 'Request ready',
                text,
                confirmButtonColor: '#8c3d3d'
            });
        } else {
            window.alert(text);
        }
    } catch (error) {
        console.error('Failed to save WhatsApp order request:', error);
        showCheckoutError('Unable to save your order request. Please try again.');
    } finally {
        submitBtn.disabled = false;
    }
}

function openGuestCheckout({ items, coupons, appliedCoupon, onAppliedCoupon } = {}) {
    ensureCheckoutModal();
    checkoutState.items = normalizeCheckoutItems(items);
    checkoutState.coupons = (coupons || []).map(mapStoreCoupon);
    checkoutState.appliedCoupon = appliedCoupon ? mapStoreCoupon(appliedCoupon) : null;
    checkoutState.onAppliedCoupon = onAppliedCoupon || null;
    showCheckoutError('');
    renderCheckoutItems();
    renderCheckoutCoupons();
    renderCheckoutTotals();
    const note = document.getElementById('guest-checkout-coupon-note');
    const input = document.getElementById('guest-checkout-coupon-input');
    if (checkoutState.appliedCoupon) {
        if (input) input.value = checkoutState.appliedCoupon.code;
        if (note) {
            note.textContent = `${checkoutState.appliedCoupon.code} applied.`;
            note.className = 'checkout-coupon-note success';
        }
    } else {
        if (input) input.value = '';
        if (note) {
            note.textContent = '';
            note.className = 'checkout-coupon-note';
        }
    }
    const overlay = document.getElementById('guest-checkout-overlay');
    overlay.hidden = false;
    overlay.classList.add('is-open');
}

function closeGuestCheckout() {
    const overlay = document.getElementById('guest-checkout-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.hidden = true;
}

async function loadStoreCoupons() {
    if (!window.supabaseClient) return [];
    const { data, error } = await window.supabaseClient
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapStoreCoupon);
}

function readStoredCart() {
    try {
        return JSON.parse(localStorage.getItem(RJ_CART_KEY) || '[]');
    } catch (error) {
        return [];
    }
}

function writeStoredCart(cart) {
    localStorage.setItem(RJ_CART_KEY, JSON.stringify(cart));
    return cart;
}

function mergeItemIntoCart(item) {
    const cart = readStoredCart();
    const color = item.color || 'Default';
    const size = item.size || 'Standard';
    const existing = cart.find((entry) =>
        String(entry.productId) === String(item.productId) &&
        entry.color === color &&
        entry.size === size
    );
    if (existing) existing.qty += Number(item.qty || 1);
    else {
        cart.push({
            productId: item.productId,
            name: item.name,
            price: Number(item.price) || 0,
            image: item.image || '',
            color,
            size,
            variant: item.variant || color,
            variantId: item.variantId || null,
            qty: Number(item.qty || 1)
        });
    }
    return writeStoredCart(cart);
}

window.RJCheckout = {
    open: openGuestCheckout,
    close: closeGuestCheckout,
    calculateTotals: calculateGuestTotals,
    mapCoupon: mapStoreCoupon,
    isCouponValid: isCouponCurrentlyValid,
    loadCoupons: loadStoreCoupons,
    readCart: readStoredCart,
    writeCart: writeStoredCart,
    mergeItemIntoCart,
    shopNumber: RJ_WHATSAPP_NUMBER
};
