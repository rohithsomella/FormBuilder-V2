using FormBuilderAppService.Models;

namespace FormBuilderAppService.Repositories.Interfaces
{
    public interface IResourceRepository
    {
        List<Resource> GetResources(string? resourceType = null);

        Resource? GetResourceById(Guid resourceId);

        List<ResourceGroup> GetResourcesList();

        Guid SaveResource(Resource model);

        void UpdateResource(Resource model);

        void DeleteResource(Guid resourceId);
    }
}
