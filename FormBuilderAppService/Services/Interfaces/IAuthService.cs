using FormBuilderAppService.Models.DTOs.Auth;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface IAuthService
    {
        /// <summary>
        /// Validates a username-or-email plus password against ASP.NET Core Identity and
        /// issues a JWT. Returns null for every failure - unknown user, wrong password,
        /// locked out - so the caller cannot accidentally leak which one it was.
        /// </summary>
        Task<LoginResponse?> LoginAsync(LoginRequest request);

        /// <summary>
        /// Loads the current user by id, as taken from a validated token.
        /// </summary>
        Task<CurrentUserDto?> GetUserByIdAsync(Guid userId);
    }
}
