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

    // Performance optimizations
    this.isUpdating = false;
    this.updateQueue = null;
    this.debounceTimer = null;

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
    // Prevent multiple simultaneous updates
    if (this.isUpdating) {
      this.updateQueue = true;
      return;
    }

    this.isUpdating = true;
    this.showLoadingState();

    try {
      // Use Shopify Section Rendering API for faster updates
      const response = await fetch(`${window.location.pathname}?sections=cart-drawer`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      const sections = await response.json();

      if (sections['cart-drawer']) {
        // Use requestAnimationFrame for smooth DOM updates
        requestAnimationFrame(() => {
          // Parse the section HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(sections['cart-drawer'], 'text/html');

          // Batch DOM updates to minimize reflows
          this.batchUpdate(() => {
            // Update the entire cart drawer content to ensure footer shows/hides correctly
            const newDrawer = doc.getElementById('cartDrawer');
            if (newDrawer && this.drawer) {
              // Save the current scroll position
              const scrollTop = this.itemsContainer?.scrollTop || 0;

              // Update entire drawer content
              this.drawer.innerHTML = newDrawer.innerHTML;

              // Re-initialize references since DOM was replaced
              this.itemsContainer = document.getElementById('cartDrawerItems');
              this.closeBtn = document.getElementById('closeCartDrawer');
              this.continueBtn = document.getElementById('continueShoppingBtn');

              // Re-attach event listeners
              if (this.closeBtn) {
                this.closeBtn.addEventListener('click', () => this.close());
              }
              if (this.continueBtn) {
                this.continueBtn.addEventListener('click', () => this.close());
              }

              // Restore scroll position
              if (this.itemsContainer) {
                this.itemsContainer.scrollTop = scrollTop;
              }

              // Re-initialize quantity controls
              this.initQuantityControls();
            }

            // Update header cart count
            const newCount = doc.getElementById('cartItemCount');
            const headerCartCount = document.querySelector('.header-cart-count');
            if (headerCartCount && newCount) {
              headerCartCount.textContent = newCount.textContent;
            }
          });

          this.hideLoadingState();
          this.isUpdating = false;

          // Process queued update if any
          if (this.updateQueue) {
            this.updateQueue = false;
            this.refreshCart();
          }
        });
      }

    } catch (error) {
      console.error('Error refreshing cart:', error);
      this.hideLoadingState();
      this.isUpdating = false;
    }
  }

  // Batch DOM updates to minimize reflows
  batchUpdate(callback) {
    // Use opacity instead of display to maintain layout
    const oldOpacity = this.itemsContainer.style.opacity;
    const oldTransition = this.itemsContainer.style.transition;

    this.itemsContainer.style.transition = 'none';
    this.itemsContainer.style.opacity = '0';

    // Force a reflow
    void this.itemsContainer.offsetHeight;

    // Execute updates
    callback();

    // Restore with smooth fade-in
    requestAnimationFrame(() => {
      this.itemsContainer.style.transition = 'opacity 0.2s ease';
      this.itemsContainer.style.opacity = oldOpacity || '1';

      // Cleanup
      setTimeout(() => {
        this.itemsContainer.style.transition = oldTransition;
      }, 200);
    });
  }

  showLoadingState() {
    // Add loading indicator without blocking UI
    if (!this.loadingOverlay) {
      this.loadingOverlay = document.createElement('div');
      this.loadingOverlay.className = 'cart-loading-overlay';
      this.loadingOverlay.innerHTML = '<div class="cart-loading-spinner"></div>';
      this.drawer.appendChild(this.loadingOverlay);
    }
    this.loadingOverlay.classList.add('active');
  }

  hideLoadingState() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('active');
    }
  }

  initQuantityControls() {
    // Remove any existing listeners by cloning and replacing the element
    if (!this.itemsContainer) return;

    // Store handlers as instance methods if not already stored
    if (!this.clickHandler) {
      this.clickHandler = async (e) => {
        const target = e.target.closest('.quantity-decrease, .quantity-increase, .remove-btn');
        if (!target) return;

        // Prevent rapid clicks
        if (this.isUpdating) return;

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
      };

      this.changeHandler = async (e) => {
        if (e.target.classList.contains('quantity-input')) {
          if (this.isUpdating) return;

          const line = e.target.dataset.line;
          const newQty = parseInt(e.target.value);

          if (newQty === 0) {
            await this.removeItem(line);
          } else if (newQty > 0) {
            await this.updateQuantity(line, newQty);
          }
        }
      };
    }

    // Remove old listeners if they exist
    if (this.itemsContainer.dataset.listenersAttached) {
      this.itemsContainer.removeEventListener('click', this.clickHandler);
      this.itemsContainer.removeEventListener('change', this.changeHandler);
    }

    // Add listeners
    this.itemsContainer.addEventListener('click', this.clickHandler);
    this.itemsContainer.addEventListener('change', this.changeHandler);
    this.itemsContainer.dataset.listenersAttached = 'true';
  }

  initRemoveButtons() {
    // No longer needed - handled by event delegation in initQuantityControls
  }

  async updateQuantity(line, quantity) {
    // Prevent multiple simultaneous updates
    if (this.isUpdating) return;

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
        await this.refreshCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }

  async removeItem(line) {
    // Prevent multiple simultaneous updates
    if (this.isUpdating) return;

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
        await this.refreshCart();
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
