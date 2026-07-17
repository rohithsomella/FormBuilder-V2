using FormBuilderAppService.Models;
namespace FormBuilderAppService.Repositories.Interfaces
{
    public interface ITenantRepository
    {
        List<Tenant> GetTenants();

        void UpdateTenant(Tenant model);

        void DeleteTenant(Guid tenantId, string? deletedBy = null);
    }
}