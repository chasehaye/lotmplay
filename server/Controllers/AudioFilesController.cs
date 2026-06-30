using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models;

namespace server.Controllers;

[ApiController]
[Route("api/audiofiles")]
public class AudioFilesController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(AudioFile file)
    {
        db.AudioFiles.Add(file);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = file.Id }, file);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var file = await db.AudioFiles.FindAsync(id);
        return file is null ? NotFound() : Ok(file);
    }

    [HttpPatch("{id:int}/duration")]
    public async Task<IActionResult> UpdateDuration(int id, [FromBody] double duration)
    {
        var file = await db.AudioFiles.FindAsync(id);
        if (file is null) return NotFound();
        file.Duration = duration;
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, IConfiguration config)
    {
        var file = await db.AudioFiles.FindAsync(id);
        if (file is null) return NotFound();
        db.AudioFiles.Remove(file);
        await db.SaveChangesAsync();

        var uploadsRoot = config["Uploads:Path"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        // FileUrl is like /files/{audiobookId}/audio/filename.wav
        var relativePath = file.FileUrl.Replace("/files/", "");
        var fullPath = Path.Combine(uploadsRoot, relativePath);
        if (System.IO.File.Exists(fullPath))
            System.IO.File.Delete(fullPath);

        return NoContent();
    }
}
