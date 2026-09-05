// ======= PRODUCT DATA =======
const products = {
  female: [
    { name: 'F Crop', image: 'f-crop.jpg', price: 120, reviews: '160' },
    { name: 'F Leggings', image: 'f-leggings.jpg', price: 130, reviews: '150' },
    { name: 'F Bra', image: 'f-bra.jpg', price: 110, reviews: '140' },
    { name: 'F Set', image: 'f-set.jpg', price: 190, reviews: '130' },
    { name: 'F Jacket', image: 'f-jacket.jpg', price: 210, reviews: '120' }
  ],
  male: [
    { name: 'M Shorts', image: 'm-shorts.jpg', price: 90, reviews: '110' },
    { name: 'M Tank', image: 'm-tank.jpg', price: 110, reviews: '100' },
    { name: 'M Joggers', image: 'm-joggers.jpg', price: 160, reviews: '90' },
    { name: 'M Hoodie', image: 'm-hoodie.jpg', price: 180, reviews: '80' },
    { name: 'M Socks', image: 'm-socks.jpg', price: 50, reviews: '70' }
  ]
};

// ======= CART ELEMENTS HELPERS =======
function refreshCartElements() {
  // Handles both ../ and src/ based on current page
  window.cartDrawer = document.getElementById('cartDrawer');
  window.backdrop = document.getElementById('backdrop');
  window.cartContentContainer = document.getElementById('cartItem');
}
refreshCartElements();

// ======= RENDER PRODUCTS FOR INDEX =======
const productGrid = document.getElementById('product-grid');
const womenBtn = document.getElementById('tab-women');
const menBtn = document.getElementById('tab-men');

// Only render if on index.html
function renderProducts(gender) {
  if (!productGrid) return;
  productGrid.innerHTML = '';
  products[gender].forEach(prod => {
    // Product Card
    const div = document.createElement('div');
    div.className = 'text-center border rounded p-4 cursor-pointer hover:shadow relative group';
    div.onclick = () => {
      localStorage.setItem('selectedProduct', JSON.stringify(prod));
      window.location.href = 'src/pages/product.html';
    };
    div.innerHTML = `
      <img src="src/images/${prod.image}" alt="${prod.name}" class="w-full mb-2">
      <h3 class="font-semibold">${prod.name}</h3>
      <p class="text-sm">€ ${prod.price}.00</p>
    `;
    // Add to Cart button (stops propagation)
    const addButton = document.createElement('button');
    addButton.className = 'bg-black text-white px-4 py-2 mt-2 rounded hover:opacity-90 z-10';
    addButton.textContent = 'Add to Cart';
    addButton.onclick = (e) => {
      e.stopPropagation();
      addToCart({ ...prod, qty: 1 });
    };
    div.appendChild(addButton);
    productGrid.appendChild(div);
  });
}

if (womenBtn && menBtn && productGrid) {
  womenBtn.addEventListener('click', () => {
    womenBtn.classList.add('bg-black', 'text-white');
    menBtn.classList.remove('bg-black', 'text-white');
    renderProducts('female');
  });

  menBtn.addEventListener('click', () => {
    menBtn.classList.add('bg-black', 'text-white');
    womenBtn.classList.remove('bg-black', 'text-white');
    renderProducts('male');
  });

  renderProducts('female');
}

// ======= ADD TO CART / CART UTILS =======
function addToCart(item) {
  try {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingIndex = cart.findIndex(i => i.name === item.name);
    if (existingIndex !== -1) {
      cart[existingIndex].qty += 1;
    } else {
      cart.push({ ...item, qty: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    refreshCartElements();
    openCart();
    renderCartItems();
  } catch (e) {
    console.error('Error adding to cart:', e);
  }
}

function updateCartQuantity(itemName, change) {
  try {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const itemIndex = cart.findIndex(i => i.name === itemName);
    if (itemIndex !== -1) {
      cart[itemIndex].qty += change;
      if (cart[itemIndex].qty <= 0) {
        cart.splice(itemIndex, 1);
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      refreshCartElements();
      renderCartItems();
    }
  } catch (e) {
    console.error('Error updating cart quantity:', e);
  }
}

function removeFromCart(itemName) {
  try {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const updatedCart = cart.filter(item => item.name !== itemName);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
    refreshCartElements();
    renderCartItems();
  } catch (e) {
    console.error('Error removing from cart:', e);
  }
}

// ======= RENDER CART DRAWER ITEMS =======
function renderCartItems() {
  refreshCartElements();
  if (!window.cartContentContainer) return;
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  let imgPrefix = 'src/images/';
  // If on product.html or cart.html in src/pages, adjust path
  if (window.location.pathname.includes('/pages/')) imgPrefix = '../images/';

  window.cartContentContainer.innerHTML = cart.length
    ? cart.map(item => `
      <div class="flex gap-4 mb-4 border-b pb-4">
        <img src="${imgPrefix}${item.image}" class="w-20 h-24 object-cover rounded" />
        <div class="flex-1">
          <p class="font-semibold">${item.name}</p>
          <p class="text-sm text-gray-600">Red | Size S</p>
          <p class="text-sm mt-1">€ ${(item.price * item.qty).toFixed(2)}</p>
          <div class="flex items-center mt-2">
            <button onclick="updateCartQuantity('${item.name}', -1)" class="px-2 py-1 border rounded">-</button>
            <span class="px-3">Qty: ${item.qty}</span>
            <button onclick="updateCartQuantity('${item.name}', 1)" class="px-2 py-1 border rounded">+</button>
            <button onclick="removeFromCart('${item.name}')" class="ml-4 text-red-500 text-sm">Remove</button>
          </div>
        </div>
      </div>
    `).join('')
    : '<p class="text-center text-gray-500">Your cart is empty.</p>';

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotalElement = document.getElementById('cartSubtotal');
  const totalElement = document.getElementById('cartTotal');
  if (subtotalElement) subtotalElement.textContent = `€ ${subtotal.toFixed(2)}`;
  if (totalElement) totalElement.textContent = `€ ${subtotal.toFixed(2)}`;
}

// ======= CART DRAWER OPEN/CLOSE =======
function openCart() {
  refreshCartElements();
  if (window.cartDrawer && window.backdrop) {
    window.cartDrawer.classList.remove('translate-x-full');
    window.backdrop.classList.remove('hidden');
    renderCartItems();
  }
}

function closeCart() {
  refreshCartElements();
  if (window.cartDrawer && window.backdrop) {
    window.cartDrawer.classList.add('translate-x-full');
    window.backdrop.classList.add('hidden');
  }
}

// ======= CLOSE ON BACKDROP CLICK =======
if (window.backdrop) {
  window.backdrop.addEventListener('click', closeCart);
}

// ======= STATIC DFYNE PRODUCTS HANDLING (for index.html section) =======
document.querySelectorAll('.dfyne-product').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      const name = card.dataset.name;
      const price = parseFloat(card.dataset.price);
      const image = card.dataset.image;
      const reviews = card.querySelector('p:nth-child(3)')?.textContent.match(/\d+/)?.[0] || '0';
      localStorage.setItem('selectedProduct', JSON.stringify({ name, price, image, reviews }));
      window.location.href = 'src/pages/product.html';
    }
  });
  const addButton = document.createElement('button');
  addButton.className = 'bg-black text-white px-4 py-2 mt-2 rounded hover:opacity-90';
  addButton.textContent = 'Add to Cart';
  addButton.onclick = (e) => {
    e.stopPropagation();
    const name = card.dataset.name;
    const price = parseFloat(card.dataset.price);
    const image = card.dataset.image;
    const reviews = card.querySelector('p:nth-child(3)')?.textContent.match(/\d+/)?.[0] || '0';
    addToCart({ name, price, image, reviews, qty: 1 });
  };
  card.appendChild(addButton);
});

// ======= INIT ON LOAD FOR ALL PAGES =======
document.addEventListener('DOMContentLoaded', () => {
  refreshCartElements();
  // If cart drawer exists, render cart items
  if (window.cartDrawer) renderCartItems();

  // If add-to-cart button exists (on product.html), set up handler
  const addBtn = document.getElementById('addToCartBtn');
  if (addBtn) {
    // Get selected product from localStorage
    const selected = JSON.parse(localStorage.getItem('selectedProduct')) || { name: 'F Crop Top', image: 'f-crop.jpg', price: 120, reviews: '160' };
    addBtn.addEventListener('click', () => {
      addToCart({ ...selected, qty: 1 });
      openCart(); // force open every time
    });
  }
});
