using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Models.Identity
{
    /// <summary>
    /// The application's user. Everything Identity already provides - UserName, Email,
    /// PasswordHash, SecurityStamp, lockout and confirmation flags - is inherited and
    /// must not be re-implemented.
    ///
    /// Guid keys are used to match the rest of the schema (Forms, Tenants and
    /// FormSubmissions are all UNIQUEIDENTIFIER).
    /// </summary>
    public class ApplicationUser : IdentityUser<Guid>
    {
        public string? FullName { get; set; }
    }
}
