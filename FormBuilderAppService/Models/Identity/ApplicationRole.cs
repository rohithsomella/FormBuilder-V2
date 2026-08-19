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
    }
}
