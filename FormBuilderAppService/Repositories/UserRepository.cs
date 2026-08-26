using FormBuilderAppService.Data;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Repositories.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FormBuilderAppService.Repositories
{
    /// <summary>
    /// Identity-backed implementation of <see cref="IUserRepository"/>.
    ///
    /// UserManager and RoleManager are used for everything that has behaviour attached -
    /// normalising a username, hashing a password, writing AspNetUserRoles. The
    /// DbContext is used only for the one read that would otherwise be a per-row query.
    /// </summary>
    public class UserRepository : IUserRepository
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<ApplicationRole> _roleManager;
        private readonly AppIdentityDbContext _dbContext;

        public UserRepository(
            UserManager<ApplicationUser> userManager,
            RoleManager<ApplicationRole> roleManager,
            AppIdentityDbContext dbContext)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _dbContext = dbContext;
        }

        public async Task<List<ApplicationUser>> GetUsersAsync(Guid currentUserId)
        {
            // Soft-deleted accounts keep their row so old references still resolve, but
            // they are not part of "the users" as far as the admin screen is concerned.
            //
            // The caller's own row is excluded in the same WHERE clause, so it is never
            // fetched at all. Filtering it out after the query would still pull the row
            // across the wire and leave it one careless mapping change away from being
            // rendered - and would offer the admin Edit and Delete buttons aimed at
            // themselves.
            return await _userManager.Users
                .AsNoTracking()
                .Where(u => !u.IsDeleted && u.Id != currentUserId)
                .OrderByDescending(u => u.Created)
                .ToListAsync();
        }

        public async Task<Dictionary<Guid, List<string>>> GetRoleNamesByUserIdAsync()
        {
            var assignments = await (
                from userRole in _dbContext.UserRoles.AsNoTracking()
                join role in _dbContext.Roles.AsNoTracking()
                    on userRole.RoleId equals role.Id
                select new { userRole.UserId, RoleName = role.Name })
                .ToListAsync();

            return assignments
                .GroupBy(a => a.UserId)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .Select(a => a.RoleName ?? string.Empty)
                        .Where(name => !string.IsNullOrEmpty(name))
                        .ToList());
        }

        public async Task<List<ApplicationRole>> GetRolesAsync()
        {
            return await _roleManager.Roles
                .AsNoTracking()
                .Where(r => !r.IsDeleted)
                .ToListAsync();
        }

        public Task<ApplicationUser?> FindByUserNameAsync(string userName) =>
            _userManager.FindByNameAsync(userName);

        public Task<ApplicationUser?> FindByEmailAsync(string email) =>
            _userManager.FindByEmailAsync(email);

        public Task<ApplicationUser?> FindByIdAsync(Guid userId) =>
            _userManager.FindByIdAsync(userId.ToString());

        public Task<IdentityResult> CreateAsync(ApplicationUser user, string password) =>
            _userManager.CreateAsync(user, password);

        // UpdateAsync, not _dbContext.SaveChanges: UserManager re-runs its validators and
        // refreshes NormalizedUserName/NormalizedEmail before it saves.
        public Task<IdentityResult> UpdateAsync(ApplicationUser user) =>
            _userManager.UpdateAsync(user);

        public Task<IList<string>> GetRolesForUserAsync(ApplicationUser user) =>
            _userManager.GetRolesAsync(user);

        public Task<IdentityResult> AddToRolesAsync(ApplicationUser user, IEnumerable<string> roles) =>
            _userManager.AddToRolesAsync(user, roles);

        public Task<IdentityResult> RemoveFromRolesAsync(ApplicationUser user, IEnumerable<string> roles) =>
            _userManager.RemoveFromRolesAsync(user, roles);

        public Task<IdentityResult> UpdateSecurityStampAsync(ApplicationUser user) =>
            _userManager.UpdateSecurityStampAsync(user);

        public Task<string> GeneratePasswordResetTokenAsync(ApplicationUser user) =>
            _userManager.GeneratePasswordResetTokenAsync(user);

        // ResetPasswordAsync, not a hand-assigned PasswordHash: this runs the password
        // validators configured in Program.cs and rotates SecurityStamp.
        public Task<IdentityResult> ResetPasswordAsync(
            ApplicationUser user, string token, string newPassword) =>
            _userManager.ResetPasswordAsync(user, token, newPassword);

        public Task<IdentityResult> DeleteAsync(ApplicationUser user) =>
            _userManager.DeleteAsync(user);
    }
}
