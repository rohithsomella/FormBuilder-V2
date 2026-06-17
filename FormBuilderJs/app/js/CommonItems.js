// ============================================
// COMMON ITEMS - Menu Bar Functionality
// ============================================

// Load common menu from commonItems.html
async function loadCommonMenu() {
    try {
        const response = await fetch('../html/commonItems.html');
        const menuHtml = await response.text();
        
        // Find the menu overlay placeholder and inject menu
        let menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.insertAdjacentHTML('afterend', menuHtml);
        } else {
            // Fallback: inject at beginning of body
            document.body.insertAdjacentHTML('afterbegin', menuHtml);
        }
        
        // Setup menu event listeners
        setupMenuEventListeners();
        
        // Reinitialize tooltips
        if (typeof $ !== 'undefined') {
            $('[data-toggle="tooltip"]').tooltip();
        }
    } catch (error) {
        console.error('Error loading common menu:', error);
    }
}

// Setup menu event listeners when DOM is ready
function initializeMenu() {
    loadCommonMenu();
}

// Menu Toggle Function
function toggleMenu() {
    try {
        const menu = document.getElementById('dropdownMenu');
        const overlay = document.getElementById('menuOverlay');
        const menuBtn = document.getElementById('menuBtn');
        
        if (menu && overlay) {
            menu.classList.toggle('show');
            overlay.classList.toggle('show');
            
            // Close tooltip when menu button is clicked
            if (typeof $ !== 'undefined' && menuBtn) {
                $(menuBtn).tooltip('hide');
            }
        } else {
            console.log('Warning: menu or overlay not found');
        }
    } catch (err) {
        console.error('Error toggling menu:', err);
    }
}

// Setup menu event listeners
function setupMenuEventListeners() {
    const overlay = document.getElementById('menuOverlay');
    const menu = document.getElementById('dropdownMenu');
    
    if (overlay && menu) {
        // Close menu when clicking on overlay
        overlay.addEventListener('click', function() {
            if (menu) {
                menu.classList.remove('show');
                overlay.classList.remove('show');
            }
        });
        
        // Close menu when clicking on menu items
        const menuItems = menu.querySelectorAll('.dropdown-menu-items a');
        menuItems.forEach(link => {
            link.addEventListener('click', function() {
                menu.classList.remove('show');
                overlay.classList.remove('show');
            });
        });
    } else {
        console.log('Warning: menu or overlay not found for event listeners');
    }
}

// Initialize menu when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeMenu();
});
