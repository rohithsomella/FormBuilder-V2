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

    // Every page carrying this menu is a signed-in page. The guard either lets the
    // page through or takes over and redirects, so nothing below has to cope with
    // there being no user.
    Auth.requireAuth().then(function (user) {
        if (!user) return;

        updateMenuProfile();
        Auth.refreshCurrentUser().then(updateMenuProfile);
    });
});

// Get initials from full name
function getInitials(name) {
    if (!name) return 'U';
    return name.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// Update menu profile display
function updateMenuProfile() {
    const user = Auth.getCurrentUser();
    const avatar = document.getElementById('menuProfileAvatar');
    const nameEl = document.getElementById('menuProfileName');
    const roleEl = document.getElementById('menuProfileRole');

    if (user && avatar && nameEl && roleEl) {
        avatar.textContent = getInitials(user.name);
        nameEl.textContent = user.name;
        roleEl.textContent = user.role;
    }
}

// Navigate to the profile page for the signed-in user's role.
// UI routing only - the API decides what an admin may actually do.
function goToProfile() {
    const user = Auth.getCurrentUser();
    const page = (user && user.role === 'Admin') ? 'adminProfile.html' : 'userProfile.html';

    const inAppHtml = window.location.pathname.includes('/app/html/');
    window.location.href = inAppHtml ? page : ('app/html/' + page);
}

// Handle profile action (sign out)
function handleProfileAction() {
    if (confirm('Are you sure you want to sign out?')) {
        // Clears the token and cached user, then returns to login.html.
        Auth.logout();
    }
}
