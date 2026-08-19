using FormBuilderAppService.Models.DTOs.Auth;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Services
{
    /// <summary>
    /// Authentication logic. Password hashing, verification and role lookup are all
    /// delegated to ASP.NET Core Identity - this class only decides whether the supplied
    /// identifier is an email or a username, and turns a successful sign-in into a token.
    /// </summary>
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly ILogger<AuthService> _logger;

        public AuthService(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IJwtTokenService jwtTokenService,
            ILogger<AuthService> logger)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _jwtTokenService = jwtTokenService;
            _logger = logger;
        }

        public async Task<LoginResponse?> LoginAsync(LoginRequest request)
        {
            var identifier = request.LoginIdentifier?.Trim();

            if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(request.Password))
            {
                return null;
            }

            var user = await FindByIdentifierAsync(identifier);

            if (user is null)
            {
                // Still log at debug only: the caller returns the same generic message
                // whether or not the account exists.
                _logger.LogDebug("Login failed: no account matched the supplied identifier.");
                return null;
            }

            // Identity verifies the hash, honours lockout, and never exposes the stored
            // password. lockoutOnFailure: true so failed attempts are recorded against
            // the account for the V2 lockout work.
            var result = await _signInManager.CheckPasswordSignInAsync(
                user, request.Password, lockoutOnFailure: true);

            if (!result.Succeeded)
            {
                _logger.LogWarning(
                    "Login failed for user {UserId}. LockedOut={LockedOut}, NotAllowed={NotAllowed}.",
                    user.Id, result.IsLockedOut, result.IsNotAllowed);
                return null;
            }

            return await BuildLoginResponseAsync(user);
        }

        public async Task<CurrentUserDto?> GetUserByIdAsync(Guid userId)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());

            if (user is null)
            {
                return null;
            }

            var roles = await _userManager.GetRolesAsync(user);
            return ToDto(user, roles);
        }

        /// <summary>
        /// Resolves one login box to one Identity user.
        ///
        /// The '@' test picks the likely lookup, then the other lookup is tried as a
        /// fallback so an account whose username happens to contain '@' (or an email
        /// stored without one) still resolves.
        /// </summary>
        private async Task<ApplicationUser?> FindByIdentifierAsync(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
            {
                return null;
            }

            if (identifier.Contains('@'))
            {
                return await _userManager.FindByEmailAsync(identifier)
                       ?? await _userManager.FindByNameAsync(identifier);
            }

            return await _userManager.FindByNameAsync(identifier)
                   ?? await _userManager.FindByEmailAsync(identifier);
        }

        private async Task<LoginResponse> BuildLoginResponseAsync(ApplicationUser user)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var (token, expiresAtUtc) = _jwtTokenService.CreateToken(user, roles);

            _logger.LogInformation(
                "Issued token for user {UserId} with roles [{Roles}].",
                user.Id, string.Join(", ", roles));

            return new LoginResponse
            {
                Token = token,
                ExpiresAtUtc = expiresAtUtc,
                User = ToDto(user, roles)
            };
        }

        private static CurrentUserDto ToDto(ApplicationUser user, IEnumerable<string> roles) => new()
        {
            UserId = user.Id,
            UserName = user.UserName ?? string.Empty,
            Email = user.Email ?? string.Empty,
            FullName = user.FullName,
            Roles = roles.ToList()
        };
    }
}
