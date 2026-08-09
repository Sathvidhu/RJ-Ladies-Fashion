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
    cloud_name='fv05tjzl',
    api_key='151836662884659',
    api_secret='T1izktU3xz3YaVJCBYLuPdCVOxI'
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

    image = request.files.get('image')

    image_url = ''
    if image:
        result = cloudinary.uploader.upload(image)
        image_url = result['secure_url']

    new_product = {
        'id': max([p.get('id', 0) for p in products], default=0) + 1,
        'name': name,
        'price': price,
        'category': category,
        'size': size_list,
        'image': image_url
    }

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

            image = request.files.get('image')

            if image:
                result = cloudinary.uploader.upload(image)
                product['image'] = result['secure_url']
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