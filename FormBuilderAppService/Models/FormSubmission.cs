namespace FormBuilderAppService.Models
{
    public class FormSubmission
    {
        public Guid SubmissionId { get; set; }

        public Guid FormId { get; set; }

        public string? SubmissionData { get; set; }

        public DateTime SubmissionDate { get; set; }
    }
}
