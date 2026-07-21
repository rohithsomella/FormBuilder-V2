using FormBuilderAppService.Models;
using FormBuilderAppService.Models.DTOs;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface IFormService
    {
        Task<List<FormDto>> GetFormsAsync();

        Task<FormDto?> GetFormByIdAsync(string id);

        Task<string> SaveFormAsync(FormDto model);

        Task UpdateFormAsync(FormDto model);

        Task DeleteFormAsync(string id);

        List<FormDto> GetFormsByTenantId(Guid tenantId);
    }
}