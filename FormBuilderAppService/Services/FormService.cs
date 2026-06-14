using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories;

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

        public Form GetFormById(Guid formId)
        {
            return _formRepository.GetFormById(formId);
        }

        public void SaveForm(Form model)
        {
            _formRepository.SaveForm(model);
        }
    }
}
