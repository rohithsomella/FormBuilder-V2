using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Services.Interfaces;
using FormBuilderAppService.Settings;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FormBuilderAppService.Services
{
    /// <summary>
    /// Issues the tokens the API later validates. Signing key, issuer, audience and
    /// lifetime all come from the "Jwt" configuration section - nothing here is
    /// hardcoded.
    /// </summary>
    public class JwtTokenService : IJwtTokenService
    {
        /// <summary>
        /// HMAC-SHA256 needs at least 256 bits of key material. Rejecting anything shorter
        /// avoids issuing tokens that are cheap to forge.
        ///
        /// Public because Program.cs enforces the same bound at startup, and the two must
        /// not be allowed to drift. The checks in the constructor below are the backstop
        /// for anything that resolves this service by another route - by the time they run
        /// the process is already accepting requests, so they are not the primary gate.
        /// </summary>
        public const int MinimumSecretKeyBytes = 32;

        private readonly JwtSettings _settings;

        public JwtTokenService(IOptions<JwtSettings> settings)
        {
            _settings = settings.Value;

            if (string.IsNullOrWhiteSpace(_settings.SecretKey))
            {
                throw new InvalidOperationException(
                    "Jwt:SecretKey is not configured. Set it in appsettings.Development.json, " +
                    "user-secrets or the JWT__SECRETKEY environment variable.");
            }

            if (Encoding.UTF8.GetByteCount(_settings.SecretKey) < MinimumSecretKeyBytes)
            {
                throw new InvalidOperationException(
                    $"Jwt:SecretKey must be at least {MinimumSecretKeyBytes} bytes " +
                    "(32 ASCII characters) to sign tokens with HMAC-SHA256.");
            }
        }

        public (string Token, DateTime ExpiresAtUtc) CreateToken(
            ApplicationUser user,
            IEnumerable<string> roles)
        {
            var issuedAt = DateTime.UtcNow;
            var expiresAt = issuedAt.AddMinutes(_settings.ExpirationMinutes);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.UserName ?? string.Empty),
                new(ClaimTypes.Email, user.Email ?? string.Empty),

                // Unique token id - the handle a V2 revocation/refresh story would use.
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.Iat,
                    new DateTimeOffset(issuedAt).ToUnixTimeSeconds().ToString(),
                    ClaimValueTypes.Integer64)
            };

            // One claim per role, so [Authorize(Roles = "Admin")] resolves without any
            // custom middleware.
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _settings.Issuer,
                audience: _settings.Audience,
                claims: claims,
                notBefore: issuedAt,
                expires: expiresAt,
                signingCredentials: credentials);

            return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
        }
    }
}
