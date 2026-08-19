using FormBuilderAppService.Models.DTOs.Auth;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Settings;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace FormBuilderAppService.Data
{
    /// <summary>
    /// Ensures the "Admin" and "User" roles exist, and creates the accounts described in
    /// the "IdentitySeed" configuration section if they are missing.
    ///
    /// Two rules this deliberately follows:
    ///  - No credential appears in C#. Usernames, emails and passwords come from
    ///    configuration, so the seeded admin can be changed without a rebuild.
    ///  - Admin status is granted by adding the user to the Admin role. Nothing anywhere
    ///    checks "is this username the admin" - the role in AspNetUserRoles is the only
    ///    source of truth.
    ///
    /// Existing users are never modified: seeding is create-if-missing only, so it cannot
    /// silently reset a password on an established database.
    /// </summary>
    public class IdentitySeeder
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<ApplicationRole> _roleManager;
        private readonly IdentitySeedSettings _seedSettings;
        private readonly ILogger<IdentitySeeder> _logger;

        public IdentitySeeder(
            UserManager<ApplicationUser> userManager,
            RoleManager<ApplicationRole> roleManager,
            IOptions<IdentitySeedSettings> seedSettings,
            ILogger<IdentitySeeder> logger)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _seedSettings = seedSettings.Value;
            _logger = logger;
        }

        public async Task SeedAsync()
        {
            await EnsureRolesAsync();

            if (!_seedSettings.Enabled)
            {
                _logger.LogInformation("Identity user seeding is disabled.");
                return;
            }

            foreach (var seedUser in _seedSettings.Users)
            {
                await EnsureUserAsync(seedUser);
            }
        }

        /// <summary>
        /// Roles are always ensured, even when user seeding is off: [Authorize(Roles =
        /// "Admin")] is meaningless if the role does not exist.
        /// </summary>
        private async Task EnsureRolesAsync()
        {
            foreach (var roleName in RoleNames.All)
            {
                if (await _roleManager.RoleExistsAsync(roleName))
                {
                    continue;
                }

                var result = await _roleManager.CreateAsync(new ApplicationRole(roleName));

                if (result.Succeeded)
                {
                    _logger.LogInformation("Created role '{Role}'.", roleName);
                }
                else
                {
                    _logger.LogError(
                        "Failed to create role '{Role}': {Errors}",
                        roleName, Describe(result));
                }
            }
        }

        private async Task EnsureUserAsync(IdentitySeedSettings.SeedUser seedUser)
        {
            if (string.IsNullOrWhiteSpace(seedUser.UserName) ||
                string.IsNullOrWhiteSpace(seedUser.Email))
            {
                _logger.LogWarning("Skipping a seed user entry with no username or email.");
                return;
            }

            var existing = await _userManager.FindByNameAsync(seedUser.UserName)
                           ?? await _userManager.FindByEmailAsync(seedUser.Email);

            if (existing is not null)
            {
                // Roles are still reconciled - a role added to configuration should take
                // effect - but the password and profile are left alone.
                await EnsureRoleAssignmentsAsync(existing, seedUser.Roles);
                return;
            }

            if (string.IsNullOrWhiteSpace(seedUser.Password))
            {
                _logger.LogWarning(
                    "Skipping seed user '{UserName}': no password configured.", seedUser.UserName);
                return;
            }

            var user = new ApplicationUser
            {
                UserName = seedUser.UserName,
                Email = seedUser.Email,
                FullName = seedUser.FullName,

                // Seeded accounts skip the confirmation flow; there is no mail sender in V1.
                EmailConfirmed = true
            };

            // CreateAsync hashes the password with Identity's PasswordHasher. The plain
            // value is never stored or logged.
            var result = await _userManager.CreateAsync(user, seedUser.Password);

            if (!result.Succeeded)
            {
                _logger.LogError(
                    "Failed to create seed user '{UserName}': {Errors}",
                    seedUser.UserName, Describe(result));
                return;
            }

            _logger.LogInformation("Created seed user '{UserName}'.", seedUser.UserName);

            await EnsureRoleAssignmentsAsync(user, seedUser.Roles);
        }

        private async Task EnsureRoleAssignmentsAsync(ApplicationUser user, IEnumerable<string> roles)
        {
            foreach (var role in roles)
            {
                if (string.IsNullOrWhiteSpace(role) || await _userManager.IsInRoleAsync(user, role))
                {
                    continue;
                }

                if (!await _roleManager.RoleExistsAsync(role))
                {
                    _logger.LogWarning(
                        "Cannot assign unknown role '{Role}' to '{UserName}'.", role, user.UserName);
                    continue;
                }

                var result = await _userManager.AddToRoleAsync(user, role);

                if (result.Succeeded)
                {
                    _logger.LogInformation(
                        "Assigned role '{Role}' to '{UserName}'.", role, user.UserName);
                }
                else
                {
                    _logger.LogError(
                        "Failed to assign role '{Role}' to '{UserName}': {Errors}",
                        role, user.UserName, Describe(result));
                }
            }
        }

        private static string Describe(IdentityResult result) =>
            string.Join("; ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
    }
}
