from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cloudinary
import cloudinary.uploader
import os
import json

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


def load_products():
    if not os.path.exists(PRODUCTS_FILE):
        return []
    with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_products(products):
    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)


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
