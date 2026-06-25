using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;

namespace FormBuilderAppService.Services
{
    public class ResourceService : IResourceService
    {
        private readonly IResourceRepository _resourceRepository;

        public ResourceService(IResourceRepository resourceRepository)
        {
            _resourceRepository = resourceRepository;
        }

        public List<Resource> GetResources(string? resourceType = null)
        {
            return _resourceRepository.GetResources(resourceType);
        }

        public Resource? GetResourceById(Guid resourceId)
        {
            return _resourceRepository.GetResourceById(resourceId);
        }

        public List<ResourceGroup> GetResourcesList()
        {
            return _resourceRepository.GetResourcesList();
        }

        public Guid SaveResource(Resource model)
        {
            return _resourceRepository.SaveResource(model);
        }

        public void UpdateResource(Resource model)
        {
            _resourceRepository.UpdateResource(model);
        }

        public void DeleteResource(Guid resourceId)
        {
            _resourceRepository.DeleteResource(resourceId);
        }
    }
}
