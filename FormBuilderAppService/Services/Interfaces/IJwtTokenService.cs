using FormBuilderAppService.Models.Identity;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface IJwtTokenService
    {
        /// <summary>
        /// Builds a signed JWT for an already-authenticated user. Roles must come from
        /// Identity - this method never derives them from the request.
        /// </summary>
        (string Token, DateTime ExpiresAtUtc) CreateToken(ApplicationUser user, IEnumerable<string> roles);
    }
}
