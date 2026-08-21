using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Models.Identity
{
    /// <summary>
    /// Application role. V1 uses exactly two: "Admin" and "User".
    ///
    /// Deriving from IdentityRole now (rather than using it directly) is what lets V3
    /// hang permissions off a role - as role claims in AspNetRoleClaims, or as a related
    /// table - without changing the authentication foundation.
    /// </summary>
    public class ApplicationRole : IdentityRole<Guid>
    {
        public ApplicationRole()
        {
        }

        public ApplicationRole(string roleName) : base(roleName)
        {
        }

        public string? Description { get; set; }

        // Same audit columns as ApplicationUser, minus IsActive: a role is either
        // defined or it is not, so there is no suspended state to record.
        // ApplicationUser and ApplicationRole cannot share a base class - they are
        // already forced to derive from IdentityUser<Guid> and IdentityRole<Guid> - so
        // these are declared on both rather than inherited.

        /// <summary>Server local time, not UTC. See ApplicationUser.Created.</summary>
        public DateTime Created { get; set; } = DateTime.Now;

        public DateTime Updated { get; set; } = DateTime.Now;

        public string? CreatedBy { get; set; }

        public string? UpdatedBy { get; set; }

        /// <summary>
        /// Soft delete. A retired role keeps its row so historical AspNetUserRoles
        /// entries still resolve to a name.
        /// </summary>
        public bool IsDeleted { get; set; }
    }
}
