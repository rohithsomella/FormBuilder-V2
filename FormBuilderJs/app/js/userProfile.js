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
        setText('fieldUserId', user.userId || '-');
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
        on('btnEditProfile', function () { alert('Edit Profile is not available in this version.'); });
        on('btnManageUsers', function () { window.location.href = 'userDetails.html'; });
    }

    function confirmSignOut() {
        if (confirm('Are you sure you want to sign out?')) {
            // Clears the token and the cached user, then returns to login.html. Nothing
            // from this session survives into the next one.
            Auth.logout();
        }
    }

    // -------------------------------------------------------------- small helpers

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
})();
