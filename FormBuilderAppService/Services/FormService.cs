using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;

namespace FormBuilderAppService.Services
{
    public class FormService : IFormService
    {
        private readonly IFormRepository _formRepository;

        public FormService(IFormRepository formRepository)
        {
            _formRepository = formRepository;
        }

        public List<Form> GetForms()
        {
            return _formRepository.GetForms();
        }

        public Form? GetFormById(Guid formId)
        {
            return _formRepository.GetFormById(formId);
        }

        public Guid SaveForm(Form model)
        {
            return _formRepository.SaveForm(model);
        }

        public void UpdateForm(Form model)
        {
            _formRepository.UpdateForm(model);
        }
    }
}
