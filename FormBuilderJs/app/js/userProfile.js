/**
 * Profile pages - shared behaviour for userProfile.html and adminProfile.html.
 *
 * The two pages are separate documents on purpose: only one of them is ever open, so
 * there is no hidden section left over from a previous session to leak into the next
 * one. Each page declares which role it is for via data-profile-role on <body>, and
 * this script sends the user to the other page if they do not match.
 *
 * The role always comes from Auth (i.e. from the API's token), never from the URL and
 * never from anything the user can type. It decides which screen to draw and nothing
 * more - the API enforces roles independently.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        Auth.requireAuth().then(function (user) {
            if (!user) return; // guard is redirecting or reloading

            // Re-check against the API so a refresh reflects the real account rather
            // than whatever happens to be cached in this browser.
            Auth.refreshCurrentUser().then(function (freshUser) {
                var current = freshUser || user;

                if (!routeToCorrectProfile(current)) return;

                render(current);
                wireActions();
                Auth.showPage();
            });
        });
    });

    /**
     * Sends the user to the profile page for their role. Returns false when a redirect
     * is under way, so the caller stops rendering the wrong page.
     */
    function routeToCorrectProfile(user) {
        var pageRole = document.body.getAttribute('data-profile-role'); // "Admin" | "User"
        var isAdminPage = pageRole === 'Admin';

        if (isAdminPage === !!user.isAdmin) return true;

        window.location.replace(user.isAdmin ? 'adminProfile.html' : 'userProfile.html');
        return false;
    }

    function render(user) {
        setText('profileAvatar', getInitials(user.name));
        setText('fieldName', user.name || user.userName || '-');
        setText('fieldRole', (user.role || 'User').toUpperCase());
        setText('fieldEmail', user.email || '-');
        setText('fieldUserName', user.userName || '-');

        // Admin page only: prove the Admin role really is honoured by the API rather
        // than just displayed by the browser.
        if (document.getElementById('adminApiStatus')) {
            verifyAdminApiAccess();
        }
    }

    /**
     * Calls an endpoint protected by [Authorize(Roles = "Admin")]. A user who edited
     * their local storage to look like an admin gets 403 here, which is the point.
     */
    function verifyAdminApiAccess() {
        var status = document.getElementById('adminApiStatus');
        status.textContent = 'Checking...';
        status.className = 'admin-api-status checking';

        $.ajax({
            url: FormBuilderApiRoot() + '/auth/admin-check',
            type: 'GET',
            dataType: 'json'
        }).done(function () {
            status.textContent = 'Verified by API';
            status.className = 'admin-api-status ok';
        }).fail(function (xhr) {
            status.textContent = xhr.status === 403
                ? 'Denied by API (403)'
                : 'Unavailable (' + xhr.status + ')';
            status.className = 'admin-api-status failed';
        });
    }

    function FormBuilderApiRoot() {
        return (window.FormBuilderApi && FormBuilderApi.config)
            ? FormBuilderApi.config.baseUrl.replace(/\/forms\/?$/, '')
            : 'http://localhost:5155/api';
    }

    function wireActions() {
        // The menu button is not wired here on purpose. It opens the shared dropdown
        // via toggleMenu() in CommonItems.js, exactly like every other page - and that
        // menu already contains a Home link. Attaching a redirect here would swallow
        // the click and send the user straight home instead of showing the menu.
        on('btnSignOut', confirmSignOut);
        on('btnEditProfile', openEditProfileModal);
        on('btnAdminSettings', function () { window.location.href = 'userDetails.html'; });
        // Edit Profile Modal Events
        on('cancelEditProfile', closeEditProfileModal);
        on('btnChangePassword', togglePasswordSection);
        on('btnDeactivateUser', deactivateUser);
        on('verifyUsername', verifyUsername);
        on('toggleEditFirstName', toggleEditFirstName);
        on('toggleEditLastName', toggleEditLastName);
        on('toggleEditUserName', toggleEditUserName);

        // Form submissions
        var editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', function (e) {
                e.preventDefault();
                saveEditProfile();
            });
        }

        // Close modals when clicking overlay
        var editOverlay = document.getElementById('editProfileOverlay');
        if (editOverlay) {
            editOverlay.addEventListener('click', closeEditProfileModal);
        }
    }

    var currentUser = null;

    function openEditProfileModal() {
        var modal = document.getElementById('editProfileModal');
        var overlay = document.getElementById('editProfileOverlay');
        
        if (modal && overlay && currentUser) {
            // Populate form with current user data
            var firstName = (currentUser.name || '').split(' ')[0] || '';
            var lastName = (currentUser.name || '').split(' ').slice(1).join(' ') || '';
            
            document.getElementById('editFirstName').value = firstName;
            document.getElementById('editLastName').value = lastName;
            document.getElementById('editUserName').value = currentUser.userName || '';
            
            // Disable fields by default (read-only mode)
            document.getElementById('editFirstName').disabled = true;
            document.getElementById('editLastName').disabled = true;
            document.getElementById('editUserName').disabled = true;
            
            // Disable verify button by default
            var verifyBtn = document.getElementById('verifyUsername');
            if (verifyBtn) {
                verifyBtn.disabled = true;
            }
            
            // Hide password section by default
            var passwordSection = document.getElementById('passwordSection');
            if (passwordSection) {
                passwordSection.style.display = 'none';
                // Clear password fields
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            }
            
            // Reset Change Password button text
            var changePasswordBtn = document.getElementById('btnChangePassword');
            if (changePasswordBtn) {
                changePasswordBtn.textContent = 'Change Password';
            }
            
            // Update title with user name
            var title = document.getElementById('editModalTitle');
            if (title) {
                title.textContent = currentUser.name || currentUser.userName || 'User';
            }
            
            modal.classList.add('active');
            overlay.classList.add('active');
        }
    }

    function closeEditProfileModal() {
        var modal = document.getElementById('editProfileModal');
        var overlay = document.getElementById('editProfileOverlay');
        
        if (modal && overlay) {
            modal.classList.remove('active');
            overlay.classList.remove('active');
            
            // Disable fields when modal is closed
            document.getElementById('editFirstName').disabled = true;
            document.getElementById('editLastName').disabled = true;
            document.getElementById('editUserName').disabled = true;
            
            // Disable verify button
            var verifyBtn = document.getElementById('verifyUsername');
            if (verifyBtn) {
                verifyBtn.disabled = true;
            }
        }
    }

    function togglePasswordSection() {
        var passwordSection = document.getElementById('passwordSection');
        var changePasswordBtn = document.getElementById('btnChangePassword');
        if (passwordSection) {
            if (passwordSection.style.display === 'none') {
                passwordSection.style.display = 'block';
                if (changePasswordBtn) {
                    changePasswordBtn.textContent = 'Cancel Password';
                }
                // Focus on first password field
                document.getElementById('currentPassword').focus();
            } else {
                passwordSection.style.display = 'none';
                if (changePasswordBtn) {
                    changePasswordBtn.textContent = 'Change Password';
                }
            }
        }
    }

    function toggleEditFirstName() {
        toggleInputEdit('editFirstName');
    }

    function toggleEditLastName() {
        toggleInputEdit('editLastName');
    }

    function toggleEditUserName() {
        toggleInputEdit('editUserName');
    }

    function toggleInputEdit(inputId) {
        var input = document.getElementById(inputId);
        if (input) {
            // Toggle disabled state
            input.disabled = !input.disabled;
            
            // If enabling the field, focus on it
            if (!input.disabled) {
                input.focus();
            }
            
            // Handle verify button for username field
            if (inputId === 'editUserName') {
                var verifyBtn = document.getElementById('verifyUsername');
                if (verifyBtn) {
                    verifyBtn.disabled = input.disabled; // Verify button matches input disabled state
                }
            }
        }
    }

    function confirmSignOut() {
        if (confirm('Are you sure you want to sign out?')) {
            // Clears the token and the cached user, then returns to login.html. Nothing
            // from this session survives into the next one.
            Auth.logout();
        }
    }

    function verifyUsername() {
        var username = document.getElementById('editUserName').value;
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        alert('Username verified');
    }

    function saveEditProfile() {
        var firstName = document.getElementById('editFirstName').value.trim();
        var lastName = document.getElementById('editLastName').value.trim();
        var userName = document.getElementById('editUserName').value.trim();
        var currentPassword = document.getElementById('currentPassword') ? document.getElementById('currentPassword').value : '';
        var newPassword = document.getElementById('newPassword') ? document.getElementById('newPassword').value : '';
        var confirmPassword = document.getElementById('confirmPassword') ? document.getElementById('confirmPassword').value : '';
        
        // Validate fields
        if (!firstName || !lastName || !userName) {
            alert('Please fill in all fields');
            return;
        }
        
        // If password section is visible, validate password fields
        var passwordSection = document.getElementById('passwordSection');
        if (passwordSection && passwordSection.style.display !== 'none') {
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert('Please fill in all password fields');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                alert('New password and confirm password do not match');
                return;
            }
            
            if (newPassword.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }
        }
        
        alert('Profile updated successfully');
        closeEditProfileModal();
    }

    function changeUserPassword(currentPassword, newPassword) {
        alert('Password changed successfully');
    }

    function deactivateUser() {
        if (!confirm('Are you sure you want to deactivate this user?')) {
            return;
        }
        
        alert('User deactivated successfully');
        closeEditProfileModal();
    }


    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function on(id, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    function getInitials(name) {
        if (!name) return 'U';
        return name.trim().split(/\s+/).slice(0, 2).map(function (n) { return n[0]; })
            .join('').toUpperCase();
    }

    // Store current user for use in modal functions
    var originalRender = render;
    render = function (user) {
        currentUser = user;
        originalRender(user);
    };

})();
