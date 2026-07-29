
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;
using FormBuilderAppService.Models;

namespace FormBuilderAppService.Services
{
    public class TenantService : ITenantService
    {
        private readonly ITenantRepository _tenantRepository;

        public TenantService(ITenantRepository tenantRepository)
        {
            _tenantRepository = tenantRepository;
        }

        public List<Tenant> GetTenants()
        {
            return _tenantRepository.GetTenants();
        }
        public void UpdateTenant(Tenant model)
        {
            _tenantRepository.UpdateTenant(model);
        }

        public void DeleteTenant(Guid tenantId, string? deletedBy = null)
        {
            _tenantRepository.DeleteTenant(tenantId, deletedBy);
        }

        public async Task<bool> SaveTenant(string tenantName)
        {
            return await _tenantRepository.SaveTenant(tenantName);
        }

    }
}



