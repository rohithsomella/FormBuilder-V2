using System.ComponentModel.DataAnnotations;

namespace FormBuilderAppService.Pdf
{
    // =====================================================================================
    //  AcroForm PDF - models and abstractions
    //
    //  An "AcroForm PDF" is the same document the normal PDF pipeline produces (the Preview
    //  page rendered by headless Chromium), with real, editable PDF form fields laid over
    //  every rendered input. The printed page supplies the look; the injected widgets supply
    //  the interactivity, so the file opens in Adobe Reader looking exactly like the Preview
    //  page but with every textbox, checkbox, radio, dropdown and textarea fillable.
    //
    //  Pipeline:
    //      AcroFormPdfService  -> render payload
    //      ChromiumPdfEngine   -> render.html (window.FormAcroForm)
    //                             renders the blank form, paginates it deterministically and
    //                             records the geometry of every control
    //      Chromium PrintToPDF -> flat PDF bytes
    //      AcroFormContentSource.PostProcessAsync
    //                          -> hands the bytes back to the same page, where pdf-lib adds
    //                             the AcroForm widgets at the recorded positions
    // =====================================================================================

    /// <summary>
    /// Defaults for the fillable PDF, bound from the "PdfRenderer:AcroForm" section of
    /// appsettings.json. A request may override any of them per call.
    /// </summary>
    public class AcroFormSettings
    {
        /// <summary>
        /// Strip each form field's own background and border so it paints nothing at all
        /// until the reader clicks into it (default).
        ///
        /// The page already carries the control - Chromium printed the very same box the
        /// Preview page draws - so a widget that paints its own white background and outline
        /// on top of it is what makes the PDF look unlike the preview. With this on, the only
        /// thing a field contributes is the text, tick or dot the reader puts in it.
        ///
        /// Turn it off to get the classic AcroForm look instead, where every field carries the
        /// opaque background pdf-lib gives it and the fillable areas stand out on their own.
        /// </summary>
        public bool TransparentFields { get; set; } = true;
    }

    /// <summary>
    /// Request for turning a form definition into a fillable (AcroForm) PDF.
    /// No submission is involved - the document is the empty form.
    /// </summary>
    public class AcroFormPdfRequest
    {
        /// <summary>Id of the form to render, as stored by /api/forms.</summary>
        [Required]
        public string FormId { get; set; } = string.Empty;

        /// <summary>Paper overrides; falls back to PdfRenderer:Page when omitted.</summary>
        public PdfPageOptions? Page { get; set; }

        /// <summary>Header/footer overrides; falls back to PdfRenderer:HeaderFooter.</summary>
        public PdfHeaderFooterOptions? HeaderFooter { get; set; }

        /// <summary>Expand every collapsed panel/accordion before printing.</summary>
        public bool ExpandCollapsible { get; set; } = true;

        /// <summary>Print the form title above the form.</summary>
        public bool ShowDocumentTitle { get; set; } = true;

        /// <summary>
        /// How Form.io Tabs are laid out once flattened: "auto" (default) lets a tab move to
        /// the next page only when it does not fit, "always" starts every tab on a new page.
        /// </summary>
        public string TabPageBreak { get; set; } = "auto";

        /// <summary>Print each tab's label as a heading above its flattened content.</summary>
        public bool ShowTabTitles { get; set; } = true;

        /// <summary>
        /// Override <see cref="AcroFormSettings.TransparentFields"/> for this request.
        /// Null (default) uses PdfRenderer:AcroForm:TransparentFields.
        /// </summary>
        public bool? TransparentFields { get; set; }

        /// <summary>Override the generated file name.</summary>
        public string? FileName { get; set; }
    }

    // -------------------------------------------------------------------------------------
    //  Render harness payload (contract with window.FormAcroForm in render.html)
    // -------------------------------------------------------------------------------------

    /// <summary>
    /// Payload handed to window.FormAcroForm.render() inside headless Chromium.
    /// Serialised with camelCase names, which is the contract render.html expects.
    /// </summary>
    public class AcroFormRenderPayload
    {
        public AcroFormRenderDocument Document { get; set; } = new();

        public AcroFormRenderOptions Options { get; set; } = new();
    }

    public class AcroFormRenderDocument
    {
        public string? Id { get; set; }

        public string? Title { get; set; }

        /// <summary>The form schema exactly as /api/forms/{id} returns it.</summary>
        public object? FormSchema { get; set; }
    }

    /// <summary>
    /// Everything the harness needs to render the form and to translate a DOM rectangle into
    /// a position on a printed page.
    ///
    /// The geometry values mirror what Chromium's PrintToPDF is about to do, so the harness
    /// can compute exactly where each control will land:
    ///   pt = cssPx * 0.75 * <see cref="Scale"/>, measured from the page's top-left corner
    ///   plus <see cref="MarginLeftPt"/> / <see cref="MarginTopPt"/>.
    /// </summary>
    public class AcroFormRenderOptions
    {
        public bool ExpandCollapsible { get; set; } = true;

        public bool ShowDocumentTitle { get; set; } = true;

        /// <summary>"auto" breaks between tabs only when one does not fit; "always" starts every tab on a new page.</summary>
        public string TabPageBreak { get; set; } = "auto";

        /// <summary>Print each tab's label as a heading above its flattened content.</summary>
        public bool ShowTabTitles { get; set; } = true;

        /// <summary>See <see cref="AcroFormSettings.TransparentFields"/>.</summary>
        public bool TransparentFields { get; set; } = true;

        public int SettleDelayMs { get; set; } = 400;

        public int AssetTimeoutMs { get; set; } = 15000;

        /// <summary>
        /// Printable page height in CSS pixels, unrounded. The harness forces a page break
        /// before any block that would cross a multiple of this height, so it knows the exact
        /// document offset at which every printed page starts.
        /// </summary>
        public double PageHeightPx { get; set; } = 970d;

        /// <summary>
        /// Slack, in CSS pixels, kept free at the bottom of every page. It absorbs the small
        /// difference between the harness's idea of a page height and Chromium's, so Chromium
        /// never inserts a page break the harness did not predict.
        /// </summary>
        public double PageBreakSafetyPx { get; set; } = 12d;

        /// <summary>Content scale handed to PrintToPDF (see <see cref="PdfPageOptions.Scale"/>).</summary>
        public double Scale { get; set; } = 1d;

        /// <summary>Left page margin in PDF points.</summary>
        public double MarginLeftPt { get; set; }

        /// <summary>Top page margin in PDF points.</summary>
        public double MarginTopPt { get; set; }

        /// <summary>Location of the vendored pdf-lib bundle, loaded on demand by the harness.</summary>
        public string PdfLibUrl { get; set; } = "/app/vendor/pdf-lib/pdf-lib.min.js";
    }

    // -------------------------------------------------------------------------------------
    //  Abstraction
    // -------------------------------------------------------------------------------------

    /// <summary>
    /// Turns a Form Builder form definition into a fillable AcroForm PDF. Sits on top of the
    /// same <see cref="IPdfEngine"/> the read-only submission PDFs use, so both documents come
    /// out of the same renderer and look identical.
    /// </summary>
    public interface IAcroFormPdfService
    {
        Task<PdfResult> GenerateAsync(AcroFormPdfRequest request, CancellationToken cancellationToken = default);

        /// <summary>Convenience overload using the default settings.</summary>
        Task<PdfResult> GenerateAsync(string formId, CancellationToken cancellationToken = default);
    }
}
