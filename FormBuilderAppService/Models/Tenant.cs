using MongoDB.Bson;
namespace FormBuilderAppService.Models
{
    public class Tenant
    {
        public Guid TenantId { get; set; }

        public string TenantName { get; set; } = string.Empty;

        public DateTime? CreatedBy { get; set; }
        public DateTime? UpdatedBy { get; set; }

        public bool IsDeleted { get; set; } = false;

        public DateTime? Created { get; set; }
        public DateTime? Updated { get; set; }
    }
}
