using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/audiobooks")]
public class AudiobooksController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Audiobooks.OrderByDescending(b => b.CreatedAt).ToListAsync());

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent() =>
        Ok(await db.Audiobooks
            .Where(b => b.LastListenedAt != null)
            .OrderByDescending(b => b.LastListenedAt)
            .FirstOrDefaultAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var book = await db.Audiobooks.FindAsync(id);
        return book is null ? NotFound() : Ok(book);
    }

    [HttpGet("{id:int}/tracks")]
    public async Task<IActionResult> GetTracks(int id) =>
        Ok(await db.AudioFiles
            .Where(f => f.AudiobookId == id)
            .OrderBy(f => f.TrackNumber)
            .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create(Audiobook book)
    {
        db.Audiobooks.Add(book);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = book.Id }, book);
    }

    [HttpGet("{id:int}/jobs")]
    public async Task<IActionResult> GetJobs(int id) =>
        Ok(await db.TtsJobs
            .Where(j => j.AudiobookId == id)
            .OrderBy(j => j.TrackNumber)
            .Select(j => new { j.Id, j.ChapterTitle, j.TrackNumber, j.Status, j.Error })
            .ToListAsync());

    [HttpPost("{id:int}/cover")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadCover(int id, [FromForm] IFormFile file, IConfiguration config)
    {
        var book = await db.Audiobooks.FindAsync(id);
        if (book is null) return NotFound();

        var uploadsRoot = config["Uploads:Path"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var dir = Path.Combine(uploadsRoot, id.ToString());
        Directory.CreateDirectory(dir);

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
        if (!allowed.Contains(ext)) return BadRequest("Invalid image type.");

        // Delete old cover if exists
        foreach (var old in Directory.GetFiles(dir, "cover.*"))
            System.IO.File.Delete(old);

        var filePath = Path.Combine(dir, $"cover{ext}");
        await using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        book.CoverUrl = $"/files/{id}/cover{ext}";
        await db.SaveChangesAsync();

        return Ok(new { coverUrl = book.CoverUrl });
    }

    [HttpPatch("{id:int}/progress")]
    public async Task<IActionResult> SaveProgress(int id, [FromBody] ProgressDto dto)
    {
        var book = await db.Audiobooks.FindAsync(id);
        if (book is null) return NotFound();
        book.LastTrackId = dto.TrackId;
        book.LastPosition = dto.Position;
        book.LastListenedAt = DateTime.UtcNow;
        var track = await db.AudioFiles.FindAsync(dto.TrackId);
        book.LastTrackTitle = track?.Title;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, IConfiguration config)
    {
        var book = await db.Audiobooks.FindAsync(id);
        if (book is null) return NotFound();
        db.Audiobooks.Remove(book);
        await db.SaveChangesAsync();

        var uploadsRoot = config["Uploads:Path"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        var bookDir = Path.Combine(uploadsRoot, id.ToString());
        if (Directory.Exists(bookDir))
            Directory.Delete(bookDir, recursive: true);

        return NoContent();
    }
}

public record ProgressDto(int TrackId, double Position);
