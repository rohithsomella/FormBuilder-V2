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

        public async Task<List<ApplicationUser>> GetUsersAsync()
        {
            // Soft-deleted accounts keep their row so old references still resolve, but
            // they are not part of "the users" as far as the admin screen is concerned.
            return await _userManager.Users
                .AsNoTracking()
                .Where(u => !u.IsDeleted)
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

        public Task<IdentityResult> CreateAsync(ApplicationUser user, string password) =>
            _userManager.CreateAsync(user, password);

        public Task<IdentityResult> AddToRolesAsync(ApplicationUser user, IEnumerable<string> roles) =>
            _userManager.AddToRolesAsync(user, roles);

        public Task<IdentityResult> DeleteAsync(ApplicationUser user) =>
            _userManager.DeleteAsync(user);
    }
}
