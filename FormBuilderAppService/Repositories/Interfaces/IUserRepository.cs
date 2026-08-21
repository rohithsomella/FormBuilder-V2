using FormBuilderAppService.Models.Identity;
using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Repositories.Interfaces
{
    /// <summary>
    /// Data access for the Identity tables (AspNetUsers, AspNetRoles, AspNetUserRoles).
    ///
    /// This is the only place that talks to UserManager/RoleManager for user
    /// administration, so the service layer never has to know that Identity is what sits
    /// underneath - the same reason TenantRepository is the only place that knows about
    /// the tenant stored procedures.
    /// </summary>
    public interface IUserRepository
    {
        /// <summary>
        /// Every account that has not been soft-deleted, newest first.
        /// </summary>
        Task<List<ApplicationUser>> GetUsersAsync();

        /// <summary>
        /// Role names for every user, keyed by user id, in a single query.
        ///
        /// Exists so listing N users does not turn into N calls to
        /// UserManager.GetRolesAsync - which is what a per-row lookup would cost.
        /// </summary>
        Task<Dictionary<Guid, List<string>>> GetRoleNamesByUserIdAsync();

        /// <summary>
        /// The roles that actually exist in AspNetRoles and have not been retired.
        /// </summary>
        Task<List<ApplicationRole>> GetRolesAsync();

        Task<ApplicationUser?> FindByUserNameAsync(string userName);

        Task<ApplicationUser?> FindByEmailAsync(string email);

        /// <summary>
        /// Creates the account. The password is hashed by Identity's PasswordHasher; the
        /// plain value never reaches the database.
        /// </summary>
        Task<IdentityResult> CreateAsync(ApplicationUser user, string password);

        Task<IdentityResult> AddToRolesAsync(ApplicationUser user, IEnumerable<string> roles);

        /// <summary>
        /// Removes an account. Used to undo a half-finished create - a user whose roles
        /// could not be assigned must not be left behind in a state nobody asked for.
        /// </summary>
        Task<IdentityResult> DeleteAsync(ApplicationUser user);
    }
}
