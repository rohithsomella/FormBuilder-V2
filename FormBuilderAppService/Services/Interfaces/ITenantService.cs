using FormBuilderAppService.Models;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface ITenantService
    {
        List<Tenant> GetTenants();

        void UpdateTenant(Tenant model);

        void DeleteTenant(Guid tenantId, string? deletedBy = null);
        Task<bool> SaveTenant(string tenantName);

    }
}