namespace FormBuilderAppService.Settings
{
    /// <summary>
    /// Bound from the "Jwt" configuration section. The signing key is deliberately not
    /// given a default: a missing key must fail loudly at startup rather than silently
    /// signing tokens with a well-known value.
    /// </summary>
    public class JwtSettings
    {
        public string SecretKey { get; set; } = string.Empty;

        public string Issuer { get; set; } = string.Empty;

        public string Audience { get; set; } = string.Empty;

        public int ExpirationMinutes { get; set; } = 60;
    }
}
