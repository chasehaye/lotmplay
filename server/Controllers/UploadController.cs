using Microsoft.AspNetCore.Mvc;
using server.Data;
using server.Models;
using server.Services;

namespace server.Controllers;

[ApiController]
[Route("api/audiobooks/{audiobookId:int}/upload")]
public class UploadController(AppDbContext db, TtsQueue ttsQueue, PdfChapterParser pdfParser, EpubChapterParser epubParser, IConfiguration config) : ControllerBase
{
    private string UploadsRoot => config["Uploads:Path"]
        ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");

    [HttpPost("audio")]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> UploadAudio(int audiobookId, [FromForm] IFormFile file)
    {
        var book = await db.Audiobooks.FindAsync(audiobookId);
        if (book is null) return NotFound();

        var dir = Path.Combine(UploadsRoot, audiobookId.ToString(), "audio");
        Directory.CreateDirectory(dir);

        var trackNumber = db.AudioFiles.Count(f => f.AudiobookId == audiobookId) + 1;
        var ext = Path.GetExtension(file.FileName);
        var fileName = $"track_{trackNumber:D3}{ext}";
        var filePath = Path.Combine(dir, fileName);

        await using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        var track = new AudioFile
        {
            AudiobookId = audiobookId,
            Title = Path.GetFileNameWithoutExtension(file.FileName),
            TrackNumber = trackNumber,
            Duration = 0,
            FileUrl = $"/files/{audiobookId}/audio/{fileName}",
        };
        db.AudioFiles.Add(track);
        await db.SaveChangesAsync();

        return Ok(track);
    }

    // Step 1: upload PDF or EPUB, get detected chapters for user review
    [HttpPost("pdf/preview")]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> PreviewPdf(int audiobookId, [FromForm] IFormFile file)
    {
        var book = await db.Audiobooks.FindAsync(audiobookId);
        if (book is null) return NotFound();

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".pdf" && ext != ".epub")
            return BadRequest("Only PDF and EPUB files are supported.");

        var dir = Path.Combine(UploadsRoot, audiobookId.ToString());
        Directory.CreateDirectory(dir);
        var pendingPath = Path.Combine(dir, $"pending{ext}");
        await using (var fs = System.IO.File.Create(pendingPath))
            await file.CopyToAsync(fs);

        List<ChapterPreview> previews;
        await using (var stream = System.IO.File.OpenRead(pendingPath))
            previews = ext == ".epub" ? epubParser.Preview(stream) : pdfParser.Preview(stream);

        return Ok(previews);
    }

    // Step 2: user confirms which chapter indices to use
    [HttpPost("pdf/confirm")]
    public async Task<IActionResult> ConfirmPdf(int audiobookId, [FromBody] ConfirmDto dto)
    {
        var book = await db.Audiobooks.FindAsync(audiobookId);
        if (book is null) return NotFound();

        var dir = Path.Combine(UploadsRoot, audiobookId.ToString());
        var pendingPath = Directory.GetFiles(dir, "pending.*").FirstOrDefault();
        if (pendingPath is null)
            return BadRequest("No pending file found. Please upload again.");

        var ext = Path.GetExtension(pendingPath).ToLowerInvariant();

        List<Chapter> allChapters;
        await using (var stream = System.IO.File.OpenRead(pendingPath))
            allChapters = ext == ".epub" ? epubParser.Parse(stream) : pdfParser.Parse(stream);

        var selected = allChapters
            .Where((_, i) => dto.SelectedIndices.Contains(i))
            .ToList();

        if (selected.Count == 0)
            return BadRequest("No chapters selected.");

        var audioDir = Path.Combine(UploadsRoot, audiobookId.ToString(), "audio");
        Directory.CreateDirectory(audioDir);

        var jobs = new List<TtsJob>();
        var startTrack = db.AudioFiles.Count(f => f.AudiobookId == audiobookId) + 1;

        for (int i = 0; i < selected.Count; i++)
        {
            var chapter = selected[i];
            var trackNum = startTrack + i;
            var textFile = Path.Combine(audioDir, $"track_{trackNum:D3}.txt");
            await System.IO.File.WriteAllTextAsync(textFile, chapter.Text);

            var job = new TtsJob
            {
                AudiobookId = audiobookId,
                ChapterTitle = chapter.Title,
                TrackNumber = trackNum,
                Status = TtsJobStatus.Pending,
            };
            db.TtsJobs.Add(job);
            jobs.Add(job);
        }

        await db.SaveChangesAsync();

        foreach (var job in jobs)
            ttsQueue.Enqueue(new TtsWorkItem(job.Id));

        // Clean up temp file
        System.IO.File.Delete(pendingPath);

        return Ok(jobs.Select(j => new { j.Id, j.ChapterTitle, j.TrackNumber, j.Status }));
    }

    [HttpPost("pdf")]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> UploadPdf(int audiobookId, [FromForm] IFormFile file)
    {
        var book = await db.Audiobooks.FindAsync(audiobookId);
        if (book is null) return NotFound();

        var dir = Path.Combine(UploadsRoot, audiobookId.ToString(), "audio");
        Directory.CreateDirectory(dir);

        List<Chapter> chapters;
        await using (var stream = file.OpenReadStream())
            chapters = pdfParser.Parse(stream);

        var jobs = new List<TtsJob>();
        var startTrack = db.AudioFiles.Count(f => f.AudiobookId == audiobookId) + 1;

        foreach (var chapter in chapters)
        {
            var textFile = Path.Combine(dir, $"track_{(startTrack + chapter.Number - 1):D3}.txt");
            await System.IO.File.WriteAllTextAsync(textFile, chapter.Text);

            var job = new TtsJob
            {
                AudiobookId = audiobookId,
                ChapterTitle = chapter.Title,
                TrackNumber = startTrack + chapter.Number - 1,
                Status = TtsJobStatus.Pending,
            };
            db.TtsJobs.Add(job);
            jobs.Add(job);
        }

        await db.SaveChangesAsync();

        foreach (var job in jobs)
            ttsQueue.Enqueue(new TtsWorkItem(job.Id));

        return Ok(jobs.Select(j => new { j.Id, j.ChapterTitle, j.TrackNumber, j.Status }));
    }
}

public record ConfirmDto(List<int> SelectedIndices);
