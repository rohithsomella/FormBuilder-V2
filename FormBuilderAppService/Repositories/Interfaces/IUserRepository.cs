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
        /// Every account that has not been soft-deleted, except the caller's own, newest
        /// first.
        /// </summary>
        /// <param name="currentUserId">
        /// The signed-in admin, excluded in the SQL WHERE clause rather than dropped from
        /// the results afterwards - so their row is never read, never mapped, and cannot
        /// be leaked by a later change to the mapping code.
        /// </param>
        Task<List<ApplicationUser>> GetUsersAsync(Guid currentUserId);

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
        /// Loads one account for editing.
        ///
        /// Unlike <see cref="GetUsersAsync"/> this returns a tracked entity - the caller
        /// is going to change it and hand it back to <see cref="UpdateAsync"/>, which an
        /// AsNoTracking copy could not support. Soft-deleted rows are returned too, so
        /// the caller can tell "no such user" apart from "that user was deleted".
        /// </summary>
        Task<ApplicationUser?> FindByIdAsync(Guid userId);

        /// <summary>
        /// Creates the account. The password is hashed by Identity's PasswordHasher; the
        /// plain value never reaches the database.
        /// </summary>
        Task<IdentityResult> CreateAsync(ApplicationUser user, string password);

        /// <summary>
        /// Writes back a user loaded by <see cref="FindByIdAsync"/>.
        ///
        /// Goes through UserManager rather than SaveChanges so a changed UserName gets its
        /// NormalizedUserName rewritten - login looks the account up by the normalised
        /// column, so an entity saved directly would rename the user out of their own
        /// sign-in.
        /// </summary>
        Task<IdentityResult> UpdateAsync(ApplicationUser user);

        /// <summary>
        /// The role names currently assigned to one user. Used by an edit to work out
        /// what to add and what to take away.
        /// </summary>
        Task<IList<string>> GetRolesForUserAsync(ApplicationUser user);

        Task<IdentityResult> AddToRolesAsync(ApplicationUser user, IEnumerable<string> roles);

        Task<IdentityResult> RemoveFromRolesAsync(ApplicationUser user, IEnumerable<string> roles);

        /// <summary>
        /// Rotates the account's SecurityStamp, which invalidates every token already
        /// issued for it - the stamp is carried in the token and compared on each request.
        ///
        /// Needed because AddToRolesAsync and RemoveFromRolesAsync do not touch the stamp
        /// themselves, unlike ResetPasswordAsync. Without this an admin could take away a
        /// role and the user would keep exercising it until their token expired.
        /// </summary>
        Task<IdentityResult> UpdateSecurityStampAsync(ApplicationUser user);

        /// <summary>
        /// A single-use token authorising a password reset for this user.
        ///
        /// An admin setting somebody else's password still goes through the token path
        /// rather than writing PasswordHash directly: that is what runs the configured
        /// password validators and rotates the security stamp. Assigning a hash by hand
        /// would skip both.
        /// </summary>
        Task<string> GeneratePasswordResetTokenAsync(ApplicationUser user);

        /// <summary>
        /// Applies a new password. Identity hashes it - the plain value never reaches the
        /// database, exactly as on create.
        /// </summary>
        Task<IdentityResult> ResetPasswordAsync(ApplicationUser user, string token, string newPassword);

        /// <summary>
        /// Removes an account. Used to undo a half-finished create - a user whose roles
        /// could not be assigned must not be left behind in a state nobody asked for.
        /// </summary>
        Task<IdentityResult> DeleteAsync(ApplicationUser user);
    }
}
