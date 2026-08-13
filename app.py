from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cloudinary
import cloudinary.uploader
import os
import json
import re

app = Flask(__name__)
CORS(app)

# ---------- Cloudinary ----------
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

PRODUCTS_FILE = 'products/products.json'
CATEGORIES_FILE = 'categories.json'
SEASONAL_HIGHLIGHT_FILE = 'seasonal_highlight.json'

DEFAULT_SEASONAL_HIGHLIGHT = {
    'label': 'SEASON HIGHLIGHT',
    'title': 'Curated Artisanal Crafts',
    'description': 'Immerse yourself in luxurious textures, vibrant terracotta hues, and intricate embroidery. Every piece tells a story of modern retro style.',
    'rotationInterval': 3000,
    'productIds': []
}


def load_products():
    if not os.path.exists(PRODUCTS_FILE):
        return []
    with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_products(products):
    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)


def load_categories():
    if not os.path.exists(CATEGORIES_FILE):
        return []
    with open(CATEGORIES_FILE, 'r', encoding='utf-8') as f:
        categories = json.load(f)
    # Accept the original string format if it ever exists, while serving objects.
    return [item if isinstance(item, dict) else {'id': slugify(item), 'name': item} for item in categories]


def save_categories(categories):
    with open(CATEGORIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(categories, f, indent=2, ensure_ascii=False)


def load_seasonal_highlight():
    if not os.path.exists(SEASONAL_HIGHLIGHT_FILE):
        return DEFAULT_SEASONAL_HIGHLIGHT.copy()
    try:
        with open(SEASONAL_HIGHLIGHT_FILE, 'r', encoding='utf-8') as f:
            saved = json.load(f)
        return {**DEFAULT_SEASONAL_HIGHLIGHT, **saved}
    except (json.JSONDecodeError, OSError):
        return DEFAULT_SEASONAL_HIGHLIGHT.copy()


def save_seasonal_highlight(settings):
    with open(SEASONAL_HIGHLIGHT_FILE, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)


def slugify(name):
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', str(name).lower()).strip('-'))


def category_name_from_request():
    payload = request.get_json(silent=True) or request.form
    return str(payload.get('name', '')).strip()


def upload_image(image):
    """Upload a submitted image to Cloudinary and return its secure URL."""
    return cloudinary.uploader.upload(image)['secure_url']


def get_variants_from_request():
    """Merge retained variant URLs with one replacement upload per variant."""
    variants_json = request.form.get('variants')
    if not variants_json:
        return None

    try:
        submitted_variants = json.loads(variants_json)
    except json.JSONDecodeError:
        raise ValueError('Invalid product variant data')

    if not isinstance(submitted_variants, list) or not submitted_variants:
        raise ValueError('At least one product color is required')

    variants = []
    for index, submitted in enumerate(submitted_variants):
        label = str(submitted.get('label', '')).strip()
        swatch_type = submitted.get('swatchType', 'color')
        image_url = submitted.get('image', '')
        image_upload = request.files.get(f'variant_image_{index}')
        if image_upload and image_upload.filename:
            image_url = upload_image(image_upload)

        if not label or not image_url:
            raise ValueError('Each product color needs a name and one photo')

        swatch_value = submitted.get('swatchValue', '')
        swatch_upload = request.files.get(f'variant_swatch_{index}')
        if swatch_type == 'image':
            if swatch_upload and swatch_upload.filename:
                swatch_value = upload_image(swatch_upload)
            if not swatch_value:
                raise ValueError('Each image swatch needs an image')
        else:
            swatch_type = 'color'
            swatch_value = swatch_value or '#0f766e'

        variants.append({
            'label': label,
            'swatchType': swatch_type,
            'swatchValue': swatch_value,
            'image': image_url
        })
    return variants


# ---------- API ----------

@app.route('/api/products', methods=['GET'])
def get_products():
    return jsonify(load_products())


@app.route('/api/seasonal-highlight', methods=['GET'])
def get_seasonal_highlight():
    return jsonify(load_seasonal_highlight())


@app.route('/api/seasonal-highlight', methods=['PUT'])
def update_seasonal_highlight():
    payload = request.get_json(silent=True) or {}
    product_ids = payload.get('productIds', [])
    if not isinstance(product_ids, list):
        return jsonify({'success': False, 'message': 'Product IDs must be a list.'}), 400
    if len(product_ids) > 10:
        return jsonify({'success': False, 'message': 'Select up to 10 products.'}), 400

    available_ids = {str(product.get('id')) for product in load_products()}
    normalized_ids = []
    for product_id in product_ids:
        product_id = str(product_id)
        if product_id not in available_ids:
            return jsonify({'success': False, 'message': 'One or more selected products no longer exist.'}), 400
        if product_id not in normalized_ids:
            normalized_ids.append(product_id)

    try:
        interval = int(payload.get('rotationInterval', 3000))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Rotation interval must be a number.'}), 400
    interval = max(1000, min(interval, 60000))
    settings = {
        'label': str(payload.get('label', '')).strip(),
        'title': str(payload.get('title', '')).strip(),
        'description': str(payload.get('description', '')).strip(),
        'rotationInterval': interval,
        'productIds': normalized_ids
    }
    save_seasonal_highlight(settings)
    return jsonify({'success': True, 'settings': settings})


@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify(load_categories())


@app.route('/api/categories', methods=['POST'])
def add_category():
    name = category_name_from_request()
    if not name:
        return jsonify({'success': False, 'message': 'Please enter a category name.'}), 400

    categories = load_categories()
    if any(category.get('name', '').casefold() == name.casefold() for category in categories):
        return jsonify({'success': False, 'message': 'Category already exists.'}), 409

    base_id = slugify(name)
    if not base_id:
        return jsonify({'success': False, 'message': 'Please enter a valid category name.'}), 400
    category_id = base_id
    suffix = 2
    existing_ids = {category.get('id') for category in categories}
    while category_id in existing_ids:
        category_id = f'{base_id}-{suffix}'
        suffix += 1

    category = {'id': category_id, 'name': name}
    categories.append(category)
    save_categories(categories)
    return jsonify({'success': True, 'category': category}), 201


@app.route('/api/categories/<category_id>', methods=['PUT'])
def rename_category(category_id):
    name = category_name_from_request()
    if not name:
        return jsonify({'success': False, 'message': 'Please enter a category name.'}), 400

    categories = load_categories()
    category = next((item for item in categories if item.get('id') == category_id), None)
    if not category:
        return jsonify({'success': False, 'message': 'Category not found.'}), 404
    if any(item.get('id') != category_id and item.get('name', '').casefold() == name.casefold() for item in categories):
        return jsonify({'success': False, 'message': 'Category already exists.'}), 409

    old_name = category['name']
    category['name'] = name
    save_categories(categories)

    # Product categories store display names today, so keep them aligned for a future rename UI.
    products = load_products()
    changed = False
    for product in products:
        if str(product.get('category', '')).casefold() == old_name.casefold():
            product['category'] = name
            changed = True
    if changed:
        save_products(products)

    return jsonify({'success': True, 'category': category})


@app.route('/api/categories/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    categories = load_categories()
    category = next((item for item in categories if item.get('id') == category_id), None)
    if not category:
        return jsonify({'success': False, 'message': 'Category not found.'}), 404

    products_in_category = [product for product in load_products() if str(product.get('category', '')).casefold() == category['name'].casefold()]
    if products_in_category:
        return jsonify({
            'success': False,
            'message': f'This category is currently used by {len(products_in_category)} products and cannot be deleted.',
            'productCount': len(products_in_category)
        }), 409

    save_categories([item for item in categories if item.get('id') != category_id])
    return jsonify({'success': True})


@app.route('/api/products', methods=['POST'])
def add_product():
    products = load_products()

    name = request.form.get('name')
    price = request.form.get('price')
    category = request.form.get('category')
    sizes = request.form.get('sizes', '')
    size_list = [s.strip() for s in sizes.split(',') if s.strip()]

    try:
        variants = get_variants_from_request()
    except ValueError as error:
        return jsonify({'success': False, 'message': str(error)}), 400

    image = request.files.get('image')
    image_url = upload_image(image) if image and image.filename else ''

    new_product = {
        'id': max([p.get('id', 0) for p in products], default=0) + 1,
        'name': name,
        'price': price,
        'category': category,
        'size': size_list,
        'image': image_url
    }
    if variants is not None:
        new_product['variants'] = variants
        # Retaining image keeps older storefront code and integrations compatible.
        new_product['image'] = variants[0]['image']

    products.append(new_product)
    save_products(products)

    return jsonify({'success': True, 'product': new_product})

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    products = load_products()

    for product in products:
        if product.get('id') == product_id:
            product['name'] = request.form.get('name')
            product['price'] = request.form.get('price')
            product['category'] = request.form.get('category')

            sizes = request.form.get('sizes', '')
            product['size'] = [s.strip() for s in sizes.split(',') if s.strip()]

            try:
                variants = get_variants_from_request()
            except ValueError as error:
                return jsonify({'success': False, 'message': str(error)}), 400

            if variants is not None:
                product['variants'] = variants
                product['image'] = variants[0]['image']
            else:
                image = request.files.get('image')
                if image and image.filename:
                    product['image'] = upload_image(image)
                else:
                    product['image'] = request.form.get('existing_image', product.get('image'))

            save_products(products)
            return jsonify({'success': True, 'product': product})

    return jsonify({'success': False, 'message': 'Product not found'}), 404

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    products = load_products()
    products = [p for p in products if p.get('id') != product_id]
    save_products(products)
    return jsonify({'success': True})


@app.route('/')
def home():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
