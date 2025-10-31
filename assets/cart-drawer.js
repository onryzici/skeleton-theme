/**
 * Cart Drawer JavaScript
 * Handles cart drawer functionality with smooth animations
 */

class CartDrawer {
  constructor() {
    this.drawer = document.getElementById('cartDrawer');
    this.overlay = document.getElementById('cartDrawerOverlay');
    this.closeBtn = document.getElementById('closeCartDrawer');
    this.continueBtn = document.getElementById('continueShoppingBtn');
    this.itemsContainer = document.getElementById('cartDrawerItems');

    this.init();
  }

  init() {
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Continue shopping button
    if (this.continueBtn) {
      this.continueBtn.addEventListener('click', () => this.close());
    }

    // Overlay click
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawer.classList.contains('active')) {
        this.close();
      }
    });

    // Quantity and remove controls (using event delegation)
    this.initQuantityControls();

    // Intercept all add to cart forms
    this.interceptAddToCart();
  }

  open() {
    this.drawer.classList.add('active');
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.drawer.classList.remove('active');
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  async refreshCart() {
    try {
      // Use Shopify Section Rendering API for faster updates
      const response = await fetch(`${window.location.pathname}?sections=cart-drawer`);
      const sections = await response.json();

      if (sections['cart-drawer']) {
        // Parse the section HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(sections['cart-drawer'], 'text/html');

        // Update cart count
        const newCount = doc.getElementById('cartItemCount');
        const countElement = document.getElementById('cartItemCount');
        if (newCount && countElement) {
          countElement.textContent = newCount.textContent;
        }

        // Update header cart count
        const headerCartCount = document.querySelector('.header-cart-count');
        if (headerCartCount && newCount) {
          headerCartCount.textContent = newCount.textContent;
        }

        // Update drawer items
        const newItemsContainer = doc.getElementById('cartDrawerItems');
        if (newItemsContainer && this.itemsContainer) {
          this.itemsContainer.innerHTML = newItemsContainer.innerHTML;
        }

        // Update subtotal
        const newSubtotal = doc.getElementById('cartSubtotal');
        const currentSubtotal = document.getElementById('cartSubtotal');
        if (newSubtotal && currentSubtotal) {
          currentSubtotal.textContent = newSubtotal.textContent;
        }

        // Controls are now handled by event delegation - no need to re-init
      }

    } catch (error) {
      console.error('Error refreshing cart:', error);
    }
  }

  initQuantityControls() {
    // Use event delegation for better performance
    if (!this.itemsContainer.dataset.listenersAttached) {
      this.itemsContainer.addEventListener('click', async (e) => {
        const target = e.target.closest('.quantity-decrease, .quantity-increase, .remove-btn');
        if (!target) return;

        const line = target.dataset.line;

        if (target.classList.contains('quantity-decrease')) {
          const input = document.querySelector(`.quantity-input[data-line="${line}"]`);
          const currentQty = parseInt(input.value);
          if (currentQty > 1) {
            await this.updateQuantity(line, currentQty - 1);
          } else {
            await this.removeItem(line);
          }
        } else if (target.classList.contains('quantity-increase')) {
          const input = document.querySelector(`.quantity-input[data-line="${line}"]`);
          const currentQty = parseInt(input.value);
          await this.updateQuantity(line, currentQty + 1);
        } else if (target.classList.contains('remove-btn')) {
          await this.removeItem(line);
        }
      });

      this.itemsContainer.addEventListener('change', async (e) => {
        if (e.target.classList.contains('quantity-input')) {
          const line = e.target.dataset.line;
          const newQty = parseInt(e.target.value);

          if (newQty === 0) {
            await this.removeItem(line);
          } else if (newQty > 0) {
            await this.updateQuantity(line, newQty);
          }
        }
      });

      this.itemsContainer.dataset.listenersAttached = 'true';
    }
  }

  initRemoveButtons() {
    // No longer needed - handled by event delegation in initQuantityControls
  }

  async updateQuantity(line, quantity) {
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          line: parseInt(line),
          quantity: quantity
        })
      });

      if (response.ok) {
        this.refreshCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }

  async removeItem(line) {
    try {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          line: parseInt(line),
          quantity: 0
        })
      });

      if (response.ok) {
        this.refreshCart();
      }
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }

  interceptAddToCart() {
    document.addEventListener('submit', async (e) => {
      const form = e.target;

      // Check if it's a product form
      if (form.getAttribute('action') && form.getAttribute('action').includes('/cart/add')) {
        e.preventDefault();

        const formData = new FormData(form);
        const submitButton = form.querySelector('[type="submit"]');
        const originalText = submitButton?.textContent;

        // Disable button
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Adding...';
        }

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            this.refreshCart();
            this.open();
          } else {
            const error = await response.json();
            alert(error.description || 'Error adding to cart');
          }
        } catch (error) {
          console.error('Error adding to cart:', error);
          alert('Error adding to cart. Please try again.');
        } finally {
          // Re-enable button
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
          }
        }
      }
    });

    // Global function for bundle add to cart
    window.refreshCartDrawer = () => {
      this.refreshCart();
      this.open();
    };
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CartDrawer();
  });
} else {
  new CartDrawer();
}

// Global function to open cart drawer
window.openCartDrawer = function() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');

  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};
