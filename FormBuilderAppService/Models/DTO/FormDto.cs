namespace FormBuilderAppService.Models.DTOs
{
    using Newtonsoft.Json;

    public class FormDto
    {
        public string? Id { get; set; }

        public string Title { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string Components { get; set; } = "[]";

        public int VersionId { get; set; }

        public DateTime Created { get; set; } = DateTime.UtcNow;

        public DateTime Modified { get; set; } = DateTime.UtcNow;

        public List<string> Tags { get; set; } = new();

        [JsonProperty("tenantId")]
        public Guid? TenantId { get; set; }
    }
}