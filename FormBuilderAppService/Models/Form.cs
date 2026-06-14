namespace FormBuilderAppService.Models
{
    public class Form
    {
        public Guid FormId { get; set; }

        public string FormName { get; set; }

        public string FormTitle { get; set; }

        public string FormTags { get; set; }

        public string FormJson { get; set; }
    }
}
