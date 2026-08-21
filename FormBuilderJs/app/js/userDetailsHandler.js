/**
 * User Details - "Add New User" dialog.
 *
 * Owns everything behind the "Add New User" button: loading the assignable roles,
 * verifying a username, submitting the account, and showing the one-time password the
 * API generates. The surrounding page keeps its own table, search, sort and pagination.
 *
 *   UserDetailsHandler.init({ onUserCreated: fn })  ->  wire up, preload roles
 *   UserDetailsHandler.openAddUserDialog()          ->  open a blank dialog
 *
 * Roles are fetched from the API rather than hard-coded here, so the dropdown can never
 * offer something POST /api/users would reject. This file draws UI only - the API
 * decides on its own whether the caller is allowed to create anybody.
 */
var UserDetailsHandler = (function () {
    'use strict';

    var state = {
        // [{ name, description }] as returned by GET /api/users/roles
        roles: [],
        selectedRoles: [],

        // The exact username string that last came back as available. Compared against
        // what is currently typed, so editing the box after verifying clears the tick.
        verifiedUserName: null,
        takenUserName: null,

        isSubmitting: false,
        onUserCreated: null
    };

    function escapeHtml(text) {
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function (m) {
            return map[m];
        });
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function on(id, event, handler) {
        var el = byId(id);
        if (el) el.addEventListener(event, handler);
    }

    // ---------------------------------------------------------------- setup

    function init(options) {
        state.onUserCreated = (options && options.onUserCreated) || null;

        on('btnVerifyUserName', 'click', verifyUserName);
        on('btnCancelAddUser', 'click', closeAddUserDialog);
        on('btnSaveNewUser', 'click', submitNewUser);
        on('btnCloseNewUserPassword', 'click', finishAndRefresh);
        on('btnCopyNewUserPassword', 'click', copyTemporaryPassword);
        on('roleDropdownToggle', 'click', toggleRoleDropdown);

        // Typing invalidates a previous verification - otherwise the tick from
        // "alice" would still be showing after the box was changed to "alicia".
        on('addUserUserName', 'input', function () {
            clearUserNameFeedback();
        });

        var overlay = byId('addUserModal');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeAddUserDialog();
            });
        }

        // Clicking anywhere else closes the role dropdown, which is what a native
        // <select> would do.
        document.addEventListener('click', function (e) {
            var dropdown = byId('roleDropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                setRoleDropdownOpen(false);
            }
        });

        loadRoles();
    }

    function loadRoles() {
        FormBuilderApi.getAssignableRoles(
            function (roles) {
                state.roles = Array.isArray(roles) ? roles : [];
                renderRoleOptions();
            },
            function (error) {
                console.error('Could not load roles:', error);
                state.roles = [];
                renderRoleOptions(error);
            }
        );
    }

    // ---------------------------------------------------------------- dialog

    function openAddUserDialog() {
        resetDialog();

        // A failed role load leaves the dropdown empty and the dialog unusable, so try
        // again each time it is opened rather than only once on page load.
        if (!state.roles.length) {
            loadRoles();
        }

        var modal = byId('addUserModal');
        if (modal) modal.classList.add('active');

        var firstNameInput = byId('addUserFirstName');
        if (firstNameInput) firstNameInput.focus();
    }

    function closeAddUserDialog() {
        var modal = byId('addUserModal');
        if (modal) modal.classList.remove('active');
    }

    function resetDialog() {
        setValue('addUserFirstName', '');
        setValue('addUserLastName', '');
        setValue('addUserUserName', '');
        setValue('addUserEmail', '');

        state.selectedRoles = [];
        state.isSubmitting = false;

        clearUserNameFeedback();
        hideError();
        setRoleDropdownOpen(false);
        renderRoleOptions();

        // Back to the form, in case the dialog was last left on the password screen.
        showSection('addUserFormSection');

        var saveButton = byId('btnSaveNewUser');
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
        }
    }

    /** The dialog has two faces: the form, and the one-time password afterwards. */
    function showSection(sectionId) {
        ['addUserFormSection', 'newUserPasswordSection'].forEach(function (id) {
            var section = byId(id);
            if (section) section.style.display = (id === sectionId) ? 'block' : 'none';
        });
    }

    // ---------------------------------------------------------------- roles

    function renderRoleOptions(loadError) {
        var menu = byId('roleDropdownMenu');
        if (!menu) return;

        if (!state.roles.length) {
            menu.innerHTML = '<div class="role-dropdown-empty">' +
                escapeHtml(loadError || 'No roles available') + '</div>';
            updateRoleSummary();
            return;
        }

        menu.innerHTML = state.roles.map(function (role) {
            var checked = state.selectedRoles.indexOf(role.name) !== -1;

            return '<label class="role-option" title="' + escapeHtml(role.description || role.name) + '">' +
                '<input type="checkbox" class="role-checkbox" value="' + escapeHtml(role.name) + '"' +
                (checked ? ' checked' : '') + '>' +
                '<span>' + escapeHtml(role.name) + '</span>' +
                '</label>';
        }).join('');

        Array.prototype.forEach.call(menu.querySelectorAll('.role-checkbox'), function (checkbox) {
            checkbox.addEventListener('change', onRoleCheckboxChange);
        });

        updateRoleSummary();
    }

    function onRoleCheckboxChange(e) {
        var roleName = e.target.value;
        var index = state.selectedRoles.indexOf(roleName);

        if (e.target.checked && index === -1) {
            state.selectedRoles.push(roleName);
        } else if (!e.target.checked && index !== -1) {
            state.selectedRoles.splice(index, 1);
        }

        updateRoleSummary();
        hideError();
    }

    function updateRoleSummary() {
        var label = byId('roleDropdownLabel');
        if (!label) return;

        if (!state.selectedRoles.length) {
            label.textContent = 'Select role(s)';
            label.classList.add('placeholder');
            return;
        }

        // Kept in the order the API listed them rather than the order they were ticked,
        // so the same set of roles always reads the same way.
        var ordered = state.roles
            .map(function (role) { return role.name; })
            .filter(function (name) { return state.selectedRoles.indexOf(name) !== -1; });

        label.textContent = ordered.join(', ');
        label.classList.remove('placeholder');
    }

    function toggleRoleDropdown(e) {
        e.preventDefault();
        e.stopPropagation();

        var menu = byId('roleDropdownMenu');
        setRoleDropdownOpen(!(menu && menu.classList.contains('open')));
    }

    function setRoleDropdownOpen(open) {
        var menu = byId('roleDropdownMenu');
        var toggle = byId('roleDropdownToggle');

        if (menu) menu.classList.toggle('open', open);
        if (toggle) toggle.classList.toggle('open', open);
    }

    // ---------------------------------------------------------------- username

    function verifyUserName() {
        var userName = getValue('addUserUserName');

        if (!userName) {
            setUserNameFeedback('Enter a username to verify.', 'error');
            return;
        }

        setUserNameFeedback('Checking...', 'checking');

        FormBuilderApi.checkUserName(
            userName,
            function (result) {
                if (result.isAvailable) {
                    state.verifiedUserName = userName;
                    state.takenUserName = null;
                    setUserNameFeedback(result.message, 'ok');
                } else {
                    state.verifiedUserName = null;
                    state.takenUserName = userName;
                    setUserNameFeedback(result.message, 'error');
                }
            },
            function (error) {
                state.verifiedUserName = null;
                state.takenUserName = null;
                setUserNameFeedback(error, 'error');
            }
        );
    }

    function setUserNameFeedback(message, kind) {
        var feedback = byId('userNameFeedback');
        if (!feedback) return;

        feedback.textContent = message || '';
        feedback.className = 'username-feedback' + (kind ? ' ' + kind : '');
    }

    function clearUserNameFeedback() {
        state.verifiedUserName = null;
        state.takenUserName = null;
        setUserNameFeedback('', null);
    }

    // ---------------------------------------------------------------- submit

    function submitNewUser() {
        if (state.isSubmitting) return;

        var newUser = {
            firstName: getValue('addUserFirstName'),
            lastName: getValue('addUserLastName'),
            userName: getValue('addUserUserName'),
            email: getValue('addUserEmail'),
            roles: state.selectedRoles.slice()
        };

        var validationError = validate(newUser);
        if (validationError) {
            showError(validationError);
            return;
        }

        setSubmitting(true);
        hideError();

        FormBuilderApi.createUser(
            newUser,
            function (response) {
                setSubmitting(false);
                showTemporaryPassword(response);
            },
            function (error) {
                setSubmitting(false);
                showError(error);
            }
        );
    }

    /**
     * Front-line checks only, so the obvious mistakes are caught without a round trip.
     * The API validates all of this again and is the one that decides.
     */
    function validate(newUser) {
        if (!newUser.firstName) return 'First name is required.';
        if (!newUser.lastName) return 'Last name is required.';
        if (!newUser.userName) return 'Username is required.';
        if (!newUser.email) return 'Email is required.';
        if (!newUser.roles.length) return 'Select at least one role.';

        // Only blocks on a username Verify actually reported as taken. Not verifying at
        // all is allowed - the API rejects a duplicate either way.
        if (state.takenUserName && state.takenUserName === newUser.userName) {
            return 'Username \'' + newUser.userName + '\' is already taken.';
        }

        return null;
    }

    function setSubmitting(isSubmitting) {
        state.isSubmitting = isSubmitting;

        var saveButton = byId('btnSaveNewUser');
        if (saveButton) {
            saveButton.disabled = isSubmitting;
            saveButton.textContent = isSubmitting ? 'Saving...' : 'Save';
        }
    }

    // ---------------------------------------------------------------- result

    /**
     * The API generates the password and stores only its hash, so this response is the
     * only time it can be read. The dialog therefore switches to a screen the admin has
     * to dismiss deliberately, instead of closing and losing it.
     */
    function showTemporaryPassword(response) {
        var user = (response && response.user) || {};
        var password = (response && response.temporaryPassword) || '';

        setText('newUserSummaryName', user.fullName || '');
        setText('newUserSummaryUserName', user.userName || '');
        setText('newUserSummaryEmail', user.email || '');
        setText('newUserSummaryRoles', (user.roles || []).join(', '));
        setText('newUserPasswordValue', password);

        var copyButton = byId('btnCopyNewUserPassword');
        if (copyButton) copyButton.textContent = 'Copy';

        showSection('newUserPasswordSection');
    }

    function copyTemporaryPassword() {
        var password = byId('newUserPasswordValue');
        var copyButton = byId('btnCopyNewUserPassword');
        if (!password) return;

        var done = function () {
            if (copyButton) copyButton.textContent = 'Copied';
        };

        // navigator.clipboard needs a secure context, which a plain http:// page opened
        // from a file server is not, so fall back to selecting the text for the admin.
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(password.textContent).then(done, selectPassword);
        } else {
            selectPassword();
        }
    }

    function selectPassword() {
        var password = byId('newUserPasswordValue');
        if (!password || !window.getSelection) return;

        var range = document.createRange();
        range.selectNodeContents(password);

        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /** Closes the dialog and lets the page reload the table from the API. */
    function finishAndRefresh() {
        closeAddUserDialog();

        if (state.onUserCreated) {
            state.onUserCreated();
        }
    }

    // ---------------------------------------------------------------- helpers

    function showError(message) {
        var banner = byId('addUserError');
        if (!banner) return;

        banner.textContent = message;
        banner.style.display = 'block';
    }

    function hideError() {
        var banner = byId('addUserError');
        if (banner) banner.style.display = 'none';
    }

    function getValue(id) {
        var el = byId(id);
        return el ? el.value.trim() : '';
    }

    function setValue(id, value) {
        var el = byId(id);
        if (el) el.value = value;
    }

    function setText(id, value) {
        var el = byId(id);
        if (el) el.textContent = value;
    }

    return {
        init: init,
        openAddUserDialog: openAddUserDialog,
        closeAddUserDialog: closeAddUserDialog
    };
})();
